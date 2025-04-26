import React, { useState, useEffect, useCallback } from "react";

import {
    setAuthToken,
    getAccessTokenFromCode,
    refreshAccessToken,
    getUserProfile, // Keep for potential future use or display name
    // getUserPlaylists, // GameContainer will fetch playlists now
} from "./spotifyApi";

import { generateRandomString, generateCodeChallenge } from "./utils/pkceUtils";

import LoginScreen from "./components/LoginScreen";
import GameContainer from "./components/GameContainer"; // Import the new GameContainer

import "./App.css";

function App() {
    const [accessToken, setAccessToken] = useState(null);
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // --- Configuration ---
    const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const LOCAL_DEV_URI = "http://127.0.0.1:5173/";
    const PRODUCTION_URI = "https://music-guesser-now.vercel.app/";
    const REDIRECT_URI = import.meta.env.DEV ? LOCAL_DEV_URI : PRODUCTION_URI;

    const SCOPES = [
        "user-read-email",
        "user-read-private",
        "playlist-read-private",
        "user-library-read",
        "user-read-playback-state",
        "user-modify-playback-state",
        // "streaming" // Only if using Web Playback SDK directly
    ];
    const SCOPES_URL_PARAM = SCOPES.join(" ");

    const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
    const RESPONSE_TYPE = "code";

    // --- Authentication Logic (handleLogin remains largely the same) ---
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
                client_id: CLIENT_ID,
                response_type: RESPONSE_TYPE,
                redirect_uri: REDIRECT_URI,
                scope: SCOPES_URL_PARAM,
                code_challenge_method: "S256",
                code_challenge: codeChallenge,
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

    // --- Logout Handler (Remains the same) ---
    const handleLogout = useCallback(() => {
        console.log("Logging out...");
        setAccessToken(null);
        setProfile(null);
        setError(null);
        setIsLoading(false);
        setAuthToken(null);

        localStorage.removeItem("spotify_refresh_token");
        sessionStorage.removeItem("spotify_code_verifier");

        window.history.replaceState({}, document.title, window.location.pathname);
    }, []);

    // --- Effect 1: Handle Authentication Flow (Redirect & Refresh - Minor Adjustments) ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const errorParam = urlParams.get("error");
        const storedRefreshToken = localStorage.getItem("spotify_refresh_token");

        if (isLoading || (accessToken && !code && !errorParam)) {
            return;
        }

        // Scenario 1: Redirect with code
        if (code) {
            console.log("Detected authorization code.");
            window.history.replaceState({}, document.title, window.location.pathname);
            const codeVerifier = sessionStorage.getItem("spotify_code_verifier");

            if (!codeVerifier) {
                setError("Login Error: Code verifier missing. Please log in again.");
                handleLogout();
                return;
            }

            setIsLoading(true);
            setError(null);
            getAccessTokenFromCode(CLIENT_ID, REDIRECT_URI, code, codeVerifier)
                .then((tokenData) => {
                    console.log("Token exchange successful.");
                    setAccessToken(tokenData.access_token);
                    setAuthToken(tokenData.access_token);
                    if (tokenData.refresh_token) {
                        localStorage.setItem("spotify_refresh_token", tokenData.refresh_token);
                    }
                    sessionStorage.removeItem("spotify_code_verifier");
                    return getUserProfile();
                })
                .then(userProfile => {
                    setProfile(userProfile);
                    console.log("User profile fetched:", userProfile);
                })
                .catch((err) => {
                    console.error("Token exchange or profile fetch failed:", err);
                    setError("Failed to complete login. Please try again.");
                    handleLogout();
                })
                .finally(() => setIsLoading(false));

        // Scenario 2: Redirect with error
        } else if (errorParam) {
            console.error("Spotify login error:", errorParam);
            window.history.replaceState({}, document.title, window.location.pathname);
            setError(`Spotify Login Error: ${errorParam}. Please try again.`);
            handleLogout();

        // Scenario 3: Refresh token on load
        } else if (storedRefreshToken && !accessToken) {
            console.log("Attempting token refresh on load...");
            setIsLoading(true);
            setError(null);
            refreshAccessToken(CLIENT_ID, storedRefreshToken)
                .then((tokenData) => {
                    console.log("Token refresh successful.");
                    setAccessToken(tokenData.access_token);
                    setAuthToken(tokenData.access_token);
                    if (tokenData.refresh_token) {
                        localStorage.setItem("spotify_refresh_token", tokenData.refresh_token);
                    }
                    return getUserProfile();
                })
                 .then(userProfile => {
                    setProfile(userProfile);
                    console.log("User profile fetched after refresh:", userProfile);
                 })
                .catch((err) => {
                    console.error("Refresh token or profile fetch failed:", err);
                    setError("Session expired. Please log in again.");
                    handleLogout();
                })
                .finally(() => setIsLoading(false));
        }
    }, [handleLogout, CLIENT_ID, REDIRECT_URI, accessToken, isLoading]);


    // --- Render Logic ---
    return (
        <div className="App">
            <header className="App-header">
                {!accessToken || !profile ? (
                    <LoginScreen
                        onLogin={handleLogin}
                        error={error}
                        isLoading={isLoading}
                        clientId={CLIENT_ID}
                    />
                ) : (
                    <GameContainer
                        onLogout={handleLogout}
                        userProfile={profile}
                    />
                )}
                {isLoading && (!accessToken || !profile) && <p className="loading">Authenticating...</p>}
            </header>
        </div>
    );
}

export default App;