import React, { useState, useEffect, useCallback } from "react";

import {
    setAuthToken,
    getAccessTokenFromCode,
    refreshAccessToken,
    getUserProfile,
    getUserPlaylists,
    searchItems,
    startPlayback,
    pausePlayback,
} from "./spotifyApi";

import { generateRandomString, generateCodeChallenge } from './utils/pkceUtils';

import LoginScreen from './components/LoginScreen';
import AuthenticatedApp from './components/AuthenticatedApp';

import "./App.css";


function App() {
    const [accessToken, setAccessToken] = useState(null);
    const [profile, setProfile] = useState(null);
    const [playlists, setPlaylists] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // --- Configuration ---
    const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

    const REDIRECT_URI = "https://music-guesser-now.vercel.app/";
    const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
    const RESPONSE_TYPE = "code";

    const SCOPES = [
        "user-read-email", "user-read-private", "playlist-read-private",
        "user-library-read", "user-read-playback-state", "user-modify-playback-state",
        // "streaming" // Add only if using the Web Playback SDK
    ];
    const SCOPES_URL_PARAM = SCOPES.join(" ");

    // --- Authentication Logic ---
    const handleLogin = useCallback(async () => {
        setError(null);
        setIsLoading(true);

        if (!CLIENT_ID) {
            setError("Spotify Client ID is not set.");
            setIsLoading(false);
            return;
        }

        const codeVerifier = generateRandomString(64);
        try {
            const codeChallenge = await generateCodeChallenge(codeVerifier);
            sessionStorage.setItem("spotify_code_verifier", codeVerifier);
            console.log("Stored Code Verifier");

            const params = new URLSearchParams({
                client_id: CLIENT_ID, response_type: RESPONSE_TYPE, redirect_uri: REDIRECT_URI,
                scope: SCOPES_URL_PARAM, code_challenge_method: "S256", code_challenge: codeChallenge,
            });

            const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;
            console.log("Redirecting to Spotify for authorization...");
            window.location.href = authUrl;

        } catch (err) {
            console.error("PKCE generation or redirection failed:", err);
            setError("Login initiation failed. Please try again.");
            sessionStorage.removeItem("spotify_code_verifier");
            setIsLoading(false);
        }
    }, [CLIENT_ID, REDIRECT_URI, SCOPES_URL_PARAM]);

    // Logout Handler
    const handleLogout = useCallback(() => {
        setAccessToken(null);
        setProfile(null);
        setPlaylists(null);
        setError(null);
        setIsLoading(false);
        setAuthToken(null);

        localStorage.removeItem("spotify_refresh_token");
        sessionStorage.removeItem("spotify_code_verifier");

        window.history.replaceState({}, document.title, window.location.pathname);
    }, []);

    // Effect 1: Handle Authentication Flow (Redirect & Refresh)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const errorParam = urlParams.get("error");
        const storedRefreshToken = localStorage.getItem("spotify_refresh_token");

        if (isLoading || (accessToken && !code && !errorParam)) {
            return;
        }

        // --- Scenario 1: Handling the redirect back from Spotify with a code ---
        if (code) {
            console.log("Detected authorization code.");
            window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
            const codeVerifier = sessionStorage.getItem("spotify_code_verifier");

            if (!codeVerifier) {
                setError("Login Error: Code verifier missing. Please log in again.");
                handleLogout(); return;
            }

            setIsLoading(true); setError(null);
            getAccessTokenFromCode(CLIENT_ID, REDIRECT_URI, code, codeVerifier)
                .then(tokenData => {
                    console.log("Token exchange successful.");
                    setAccessToken(tokenData.access_token);
                    setAuthToken(tokenData.access_token);
                    if (tokenData.refresh_token) {
                        localStorage.setItem("spotify_refresh_token", tokenData.refresh_token);
                    }
                    sessionStorage.removeItem("spotify_code_verifier");
                })
                .catch(err => {
                    console.log(err)
                    setError("Failed to get Spotify token. Please try again.");
                    sessionStorage.removeItem("spotify_code_verifier");
                    handleLogout();
                })
                .finally(() => setIsLoading(false));

        // --- Scenario 2: Handling a login error from Spotify redirect ---
        } else if (errorParam) {
             console.error("Spotify login error:", errorParam);
             window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
             setError(`Spotify Login Error: ${errorParam}. Please try again.`);
             handleLogout();

        // --- Scenario 3: Attempting to refresh token on load ---
        } else if (storedRefreshToken && !accessToken) { // Check accessToken here prevents loop
            console.log("Attempting token refresh on load...");
            setIsLoading(true); setError(null);
            refreshAccessToken(CLIENT_ID, storedRefreshToken)
                 .then(tokenData => {
                     console.log("Token refresh successful.");
                     setAccessToken(tokenData.access_token);
                     setAuthToken(tokenData.access_token);
                     if (tokenData.refresh_token) { // Store if a new one is provided
                         localStorage.setItem("spotify_refresh_token", tokenData.refresh_token);
                     }
                 })
                 .catch(err => {
                     console.error("Refresh token failed:", err);
                     setError("Session expired. Please log in again.");
                     handleLogout(); // Force logout if refresh fails
                 })
                 .finally(() => setIsLoading(false));
        }
    }, [handleLogout, CLIENT_ID, REDIRECT_URI, accessToken, isLoading]);


    // Effect 2: Fetch User Data Once Authenticated
    useEffect(() => {
        if (accessToken && (!profile || !playlists) && !isLoading) {
            console.log("Fetching user data...");
            setIsLoading(true);
            setError(null);

            const fetchData = async () => {
                try {
                    setAuthToken(accessToken);

                    const [userProfile, userPlaylists] = await Promise.all([
                        getUserProfile(),
                        getUserPlaylists(50)
                    ]);
                    setProfile(userProfile);
                    setPlaylists(userPlaylists);
                } catch (err) {
                    console.error("Error fetching user data:", err);
                    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                        setError("Session expired or invalid. Please log in again.");
                        handleLogout();
                    } else {
                        setError("Failed to fetch user data.");
                    }
                    setProfile(null);
                    setPlaylists(null);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [accessToken, profile, playlists, isLoading, handleLogout]);


    // --- API Call Handlers (Passed down to AuthenticatedApp) ---
    const searchForTrack = useCallback(async () => {
        if (!accessToken) return;
        const query = prompt("Enter track name to search for:");
        if (!query) return;

        setIsLoading(true); setError(null);
        try {
            const results = await searchItems(query, ["track"], 5);
            const tracks = results.tracks.items;
            if (tracks.length > 0) {
                try {
                    await startPlayback({ uris: [tracks[0].uri] });
                    alert(`Playing: ${tracks[0].name} by ${tracks[0].artists.map(a => a.name).join(', ')}.\n(Requires active Spotify device)`);
                } catch (playError) {
                    alert(`Found: ${tracks[0].name}.\nCould not start playback: ${playError.message}. Ensure Spotify is active.`);
                }
            } else {
                alert(`No tracks found for "${query}".`);
            }
        } catch (error) {
            console.error("Search failed:", error);
            setError("Search failed.");
            if (error.response?.status === 401) handleLogout();
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, handleLogout]);

    const playMyFirstPlaylist = useCallback(async () => {
        if (!accessToken || !playlists || playlists.items.length === 0) return;
        const firstPlaylist = playlists.items[0];

        setIsLoading(true); setError(null);
        try {
            await startPlayback({ context_uri: firstPlaylist.uri });
            alert(`Playing playlist: ${firstPlaylist.name}.\n(Requires active Spotify device)`);
        } catch (error) {
            console.error("Play playlist failed:", error);
            if (error.response?.status === 401) { handleLogout(); setError("Session expired."); }
            else if (error.response?.status === 404 || error.response?.status === 403){ setError("Could not play. Make sure Spotify is active."); }
            else { setError("Failed to play playlist."); }
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, playlists, handleLogout]);

    const pauseCurrentTrack = useCallback(async () => {
        if (!accessToken) return;
        setIsLoading(true); setError(null);
        try {
            await pausePlayback();
            alert("Playback paused (if active).");
        } catch (error) {
            console.error("Pause failed:", error);
             if (error.response?.status === 401) { handleLogout(); setError("Session expired."); }
            else if (error.response?.status === 404 || error.response?.status === 403){ setError("Could not pause. Make sure Spotify is active."); }
            else { setError("Failed to pause playback."); }
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, handleLogout]);

    // --- Render Logic ---
    return (
        <div className="App">
            <header className="App-header">
                {!accessToken ? (
                    <LoginScreen
                        onLogin={handleLogin}
                        error={error}
                        isLoading={isLoading}
                        clientId={CLIENT_ID}
                    />
                ) : (
                     profile && playlists ? (
                        <AuthenticatedApp
                            profile={profile}
                            playlists={playlists}
                            onLogout={handleLogout}
                            onSearch={searchForTrack}
                            onPlayFirstPlaylist={playMyFirstPlaylist}
                            onPause={pauseCurrentTrack}
                            isLoading={isLoading}
                            error={error}
                        />
                    ) : (
                         isLoading ? <p className="loading">Loading User Data...</p> : <p>Initializing...</p>
                    )
                )}
            </header>
        </div>
    );
}

export default App;