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
import "./App.css";

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
    let str = "";
    let bytes = new Uint8Array(a);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
    }

    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
    const hashed = await sha256(verifier);
    return base64urlencode(hashed);
}

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
        "user-read-email",
        "user-read-private",
        "playlist-read-private",
        "user-library-read",
        "user-read-playback-state",
        "user-modify-playback-state",
        // "streaming" // Add only if using the Web Playback SDK
    ];
    const SCOPES_URL_PARAM = SCOPES.join("%20");

    // --- PKCE Login ---
    const handleLogin = async () => {
        setError(null);
        setIsLoading(true);

        if (!CLIENT_ID) {
            setError("Spotify Client ID is not set in environment variables.");
            setIsLoading(false);
            return;
        }

        // 1. Generate Verifier and Challenge
        // Verifier needs to be between 43 and 128 characters
        const codeVerifier = generateRandomString(64);
        try {
            const codeChallenge = await generateCodeChallenge(codeVerifier);

            // 2. Store Verifier in sessionStorage (clears when tab closes)
            // Use sessionStorage because it's sensitive and only needed temporarily
            sessionStorage.setItem("spotify_code_verifier", codeVerifier);
            console.log("Stored Code Verifier");

            // 3. Build Auth URL with PKCE params
            const params = new URLSearchParams({
                client_id: CLIENT_ID,
                response_type: RESPONSE_TYPE,
                redirect_uri: REDIRECT_URI,
                scope: SCOPES_URL_PARAM,
                code_challenge_method: "S256",
                code_challenge: codeChallenge,
                show_dialog: "true", // Optional: forces user to re-approve permissions
            });

            const authUrl = `${AUTH_ENDPOINT}?${params.toString()}`;
            console.log("Redirecting to Spotify:", authUrl);

            // 4. Redirect the user
            window.location.href = authUrl;
            // Loading state will persist until redirect happens

        } catch (err) {
            console.error("PKCE generation or redirection failed:", err);
            setError("Login initiation failed. Please try again.");
            sessionStorage.removeItem("spotify_code_verifier");
            setIsLoading(false);
        }
    };

    // --- Logout ---
    const handleLogout = useCallback(() => {
        console.log("Logging out...");
        setAccessToken(null);
        setProfile(null);
        setPlaylists(null);
        setError(null);
        setIsLoading(false);
        setAuthToken(null);

        localStorage.removeItem("spotify_refresh_token");
        sessionStorage.removeItem("spotify_code_verifier");

        window.history.replaceState({}, document.title, window.location.pathname);
        console.log("Logged out state cleared.");
    }, []);


    // --- Effect 1: Handle Authentication Flow (Redirect & Refresh) ---
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const errorParam = urlParams.get("error");
        const storedRefreshToken = localStorage.getItem("spotify_refresh_token");

        if (isLoading || accessToken) {
            return;
        }

        // --- Scenario 1: Handling the redirect back from Spotify with a code ---
        if (code) {
            console.log("Detected authorization code in URL");
            // Immediately remove the code from URL bar for cleanliness and security
            window.history.replaceState({}, document.title, window.location.pathname);

            const codeVerifier = sessionStorage.getItem("spotify_code_verifier");

            if (!codeVerifier) {
                console.error("Login Error: Code verifier missing from session storage.");
                setError("Login Error: Could not verify request. Please try logging in again.");
                handleLogout();
                return;
            }

            console.log("Attempting to exchange code for token...");
            setIsLoading(true);
            setError(null);

            getAccessTokenFromCode(CLIENT_ID, REDIRECT_URI, code, codeVerifier)
                .then(tokenData => {
                    console.log("Successfully exchanged code for tokens:", tokenData);
                    setAccessToken(tokenData.access_token);
                    setAuthToken(tokenData.access_token);

                    if (tokenData.refresh_token) {
                        localStorage.setItem("spotify_refresh_token", tokenData.refresh_token);
                        console.log("Refresh token stored.");
                    } else {
                        console.warn("No refresh token received in initial exchange.");
                    }
                    sessionStorage.removeItem("spotify_code_verifier");
                })
                .catch(err => {
                    console.error("Token Exchange Error:", err);
                    setError("Failed to get Spotify token. Please try logging in again.");
                    sessionStorage.removeItem("spotify_code_verifier");
                    handleLogout();
                })
                .finally(() => {
                     console.log("Token exchange process finished.");
                     setIsLoading(false);
                });

        // --- Scenario 2: Handling a login error from Spotify redirect ---
        } else if (errorParam) {
             console.error("Spotify returned an error:", errorParam);
             // Immediately remove the error from URL bar
             window.history.replaceState({}, document.title, window.location.pathname);
             setError(`Spotify Login Error: ${errorParam}. Please try again.`);
             handleLogout(); // Ensure clean state

        // --- Scenario 3: Attempting to refresh token on load (if available) ---
        } else if (storedRefreshToken) {
            console.log("Found refresh token. Attempting refresh on load...");
            setIsLoading(true);
            setError(null);
            refreshAccessToken(CLIENT_ID, storedRefreshToken)
                 .then(tokenData => {
                     console.log("Token refreshed successfully:", tokenData);
                     setAccessToken(tokenData.access_token);
                     setAuthToken(tokenData.access_token);
                     // Spotify might issue a new refresh token during refresh
                     if (tokenData.refresh_token) {
                         localStorage.setItem("spotify_refresh_token", tokenData.refresh_token);
                         console.log("New refresh token stored.");
                     }
                     // Data fetching will be triggered by Effect 2
                 })
                 .catch(err => {
                     console.error("Refresh Token Error:", err);
                     setError("Your session likely expired. Please log in again.");
                     handleLogout(); // Logout if refresh fails
                 })
                 .finally(() => {
                     console.log("Token refresh attempt finished.");
                     setIsLoading(false);
                 });
        }
    }, [handleLogout, CLIENT_ID, REDIRECT_URI, isLoading, accessToken]);


    // --- Effect 2: Fetch User Data Once Authenticated ---
    useEffect(() => {
        // Only fetch data if we have a token, don't have profile data yet, and are not currently loading
        if (accessToken && !profile && !isLoading) {
            console.log("Access token available. Fetching user data...");
            setIsLoading(true); // Set loading state for data fetch
            setError(null);

            const fetchData = async () => {
                try {
                    // Ensure API module has the latest token (redundant if setAuthToken called earlier, but safe)
                    setAuthToken(accessToken);
                    console.log("Fetching profile...");
                    const userProfile = await getUserProfile();
                    setProfile(userProfile);
                    console.log("User Profile:", userProfile);

                    console.log("Fetching playlists...");
                    const userPlaylists = await getUserPlaylists(50); // Get up to 50 playlists
                    setPlaylists(userPlaylists);
                    console.log("User Playlists:", userPlaylists);

                } catch (err) {
                    console.error("Error fetching data:", err);
                    // Handle token expiration during data fetch
                    if (err.response && err.response.status === 401) {
                         console.warn("Token expired during data fetch. Logging out.");
                         setError("Your session expired. Please log in again.");
                         handleLogout(); // Log out if token is invalid
                    } else if (err.response && err.response.status === 403) {
                         console.error("Forbidden (403): Check API scopes or permissions.");
                         setError("Permission denied. Ensure the required scopes are granted.");
                         handleLogout(); // Log out as permissions might be wrong
                    }
                    else {
                         setError("Failed to fetch data. Please check console or try again later.");
                    }
                } finally {
                     console.log("Data fetching process finished.");
                     setIsLoading(false); // Clear loading state
                }
            };
            fetchData();
        }
    }, [accessToken, profile, isLoading, handleLogout]); // Re-run if token changes, or profile/loading state resets


    // --- API Call Handlers ---
    const searchForTrack = async () => {
        if (!accessToken) return;
        const query = prompt("Enter track name to search for:");
        if (!query) return;

        setIsLoading(true);
        setError(null);
        try {
            const results = await searchItems(query, ["track"], 5);
            const tracks = results.tracks.items;
            console.log("Search results:", tracks);
            if (tracks.length > 0) {
                // Optional: Start playback (requires active Spotify device)
                try {
                    await startPlayback({ uris: [tracks[0].uri] });
                    alert(`Playing: ${tracks[0].name} by ${tracks[0].artists.map(a => a.name).join(', ')}.\n\n(Playback requires an active Spotify device/app.)`);
                } catch (playError) {
                     console.error("Playback start failed:", playError);
                     alert(`Found track: ${tracks[0].name}.\n\nCould not start playback. Error: ${playError.message || 'Unknown'}. Make sure Spotify is active on a device.`);
                }
            } else {
                alert(`No tracks found for "${query}".`);
            }
        } catch (error) {
            console.error("Search failed:", error);
            setError("Search failed. Check console for details.");
            if (error.response?.status === 401) handleLogout(); // Logout if token expired
        } finally {
            setIsLoading(false);
        }
    };

    const playMyFirstPlaylist = async () => {
        if (!accessToken || !playlists || playlists.items.length === 0) {
            alert("No playlists found or not logged in!");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const firstPlaylist = playlists.items[0];
            const firstPlaylistUri = firstPlaylist.uri;
            await startPlayback({ context_uri: firstPlaylistUri });
            alert(`Playing your playlist: ${firstPlaylist.name}.\n\n(Playback requires an active Spotify device/app.)`);
        } catch (error) {
            console.error("Failed to play playlist:", error);
            setError("Failed to play playlist. Check console for details.");
            if (error.response?.status === 401) handleLogout(); // Logout if token expired
             else if (error.response?.status === 404 || error.response?.status === 403) {
                alert("Could not start playback. Make sure Spotify is open and active on a device.")
            }
        } finally {
            setIsLoading(false);
        }
    };

    const pauseCurrentTrack = async () => {
        if (!accessToken) return;
        setIsLoading(true);
        setError(null);
        try {
            await pausePlayback();
            alert("Playback paused (if currently playing on an active device).");
        } catch (error) {
            console.error("Failed to pause:", error);
            setError("Failed to pause playback. Check console for details.");
             if (error.response?.status === 401) handleLogout(); // Logout if token expired
             else if (error.response?.status === 404 || error.response?.status === 403) {
                alert("Could not pause playback. Make sure Spotify is open and active on a device.")
            }
        } finally {
            setIsLoading(false);
        }
    };

    // --- Render Logic ---
    return (
        <div className="App">
            <header className="App-header">
                <h1>React Spotify Client (PKCE)</h1>

                {!CLIENT_ID && (
                    <p className="error" style={{ fontWeight: 'bold' }}>
                        Warning: VITE_SPOTIFY_CLIENT_ID is not set in .env file! App cannot function.
                    </p>
                )}

                {error && <p className="error">Error: {error}</p>}
                {isLoading && <p className="loading">Loading...</p>}

                {!accessToken && !isLoading ? (
                    // Show login button if not logged in and not loading
                    <button onClick={handleLogin} disabled={!CLIENT_ID || isLoading}>
                        Login to Spotify
                    </button>
                ) : accessToken && profile ? (
                    // Show user info and controls if logged in and profile loaded
                    <div className="user-content">
                        <button onClick={handleLogout} disabled={isLoading}>Logout</button>
                        <hr />

                        <div className="profile">
                            <h2>Welcome, {profile.display_name}!</h2>
                            {profile.images?.[0]?.url && (
                                <img
                                    src={profile.images[0].url}
                                    alt="Profile"
                                    width="100"
                                    className="profile-pic"
                                />
                            )}
                            <p><small>ID: {profile.id} | Email: {profile.email}</small></p>
                        </div>

                        <div className="controls">
                            <button onClick={searchForTrack} disabled={isLoading}>
                                Search & Play Track
                            </button>
                            <button
                                onClick={playMyFirstPlaylist}
                                disabled={isLoading || !playlists || playlists.items.length === 0}
                            >
                                Play My First Playlist
                            </button>
                            <button onClick={pauseCurrentTrack} disabled={isLoading}>
                                Pause Playback
                            </button>
                        </div>

                        {playlists && (
                            <div className="playlists">
                                <h3>Your Playlists ({playlists.total}):</h3>
                                {playlists.items.length > 0 ? (
                                    <ul>
                                        {playlists.items.map((playlist) => (
                                            <li key={playlist.id}>
                                                {playlist.name} ({playlist.tracks.total} tracks)
                                                {/* Example: Add play button per playlist */}
                                                <button onClick={async () => {
                                                    try {
                                                        await startPlayback({ context_uri: playlist.uri });
                                                    } catch (e) { console.error(e); alert('Could not play list'); }
                                                }} disabled={isLoading}>Play</button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>You have no playlists.</p>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                     !isLoading && <p>Authenticating...</p>
                )}
            </header>
        </div>
    );
}

export default App;