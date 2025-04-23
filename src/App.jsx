import React, { useState, useEffect } from "react";
import {
    setAuthToken,
    getUserProfile,
    getUserPlaylists,
    searchItems,
    startPlayback,
    pausePlayback,
} from "./spotifyApi";
import "./App.css";
// Useless comment

function App() {
    const [token, setToken] = useState(
        localStorage.getItem("spotify_token") || null,
    );
    const [profile, setProfile] = useState(null);
    const [playlists, setPlaylists] = useState(null);
    const [error, setError] = useState(null);

    const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = "http://127.0.0.1:5173";
    const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
    const RESPONSE_TYPE = "token";

    const SCOPES = [
        // "streaming", // Add if using Web Playback SDK later
        "user-read-email",
        "user-read-private",
        "playlist-read-private", // Access private playlists
        "user-library-read",
        // "user-library-modify", // If you want to save tracks
        "user-read-playback-state", // Read playback state
        "user-modify-playback-state", // Control playback
    ];
    const SCOPES_URL_PARAM = SCOPES.join("%20");
    const handleLogin = () => {
        localStorage.removeItem("spotify_token");
        setToken(null);
        setError(null);
        const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
            REDIRECT_URI,
        )}&response_type=${RESPONSE_TYPE}&scope=${SCOPES_URL_PARAM}&show_dialog=true`;
        window.location.href = authUrl;
    };

    const handleLogout = () => {
        setToken(null);
        setProfile(null);
        setPlaylists(null);
        setError(null);
        setAuthToken(null);
        localStorage.removeItem("spotify_token");
        window.location.hash = "";
        console.log("Logged out");
    };

    useEffect(() => {
        let currentToken = token;

        const hash = window.location.hash;
        if (!currentToken && hash) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get("access_token");

            if (accessToken) {
                console.log(
                    "Spotify Access Token received from URL hash:",
                    accessToken,
                );
                currentToken = accessToken;
                window.location.hash = "";
                localStorage.setItem("spotify_token", accessToken);

                setToken(currentToken);
                setAuthToken(currentToken);
            } else {
                const errorParam = params.get("error");
                if (errorParam) {
                    setError(`Spotify Login Error: ${errorParam}`);
                    console.error(`Spotify Login Error: ${errorParam}`);
                    window.location.hash = "";
                }
            }
        }

        if (currentToken) {
            setAuthToken(currentToken);

            if (!profile) {
                const fetchData = async () => {
                    try {
                        setError(null);
                        console.log("Fetching user data...");
                        const userProfile = await getUserProfile();
                        setProfile(userProfile);
                        console.log("User Profile:", userProfile);

                        const userPlaylists = await getUserPlaylists(50);
                        setPlaylists(userPlaylists);
                        console.log("User Playlists:", userPlaylists);
                    } catch (err) {
                        console.error("Error fetching data:", err);
                        if (
                            err.response &&
                            (err.response.status === 401 ||
                                err.response.status === 403)
                        ) {
                            console.error(
                                "Token might be expired or invalid. Logging out.",
                            );
                            setError(
                                "Your session expired. Please log in again.",
                            );
                            setTimeout(handleLogout, 2000);
                        } else {
                            setError(
                                "Failed to fetch data. Please try again later.",
                            );
                        }
                    }
                };
                fetchData();
            }
        } else {
            setAuthToken(null);
        }
    }, [profile, token]);

    const searchForTrack = async () => {
        if (!token) return;
        const query = prompt("Enter track name to search for:");
        if (!query) return;

        try {
            setError(null);
            const results = await searchItems(query, ["track"], 5);
            const tracks = results.tracks.items;
            console.log("Search results:", tracks);
            if (tracks.length > 0) {
                alert(
                    `Found tracks:\n${tracks
                        .map(
                            (t) =>
                                `- ${t.name} by ${t.artists
                                    .map((a) => a.name)
                                    .join(", ")}`,
                        )
                        .join("\n")}`,
                );
                // Example: Play the first track found
                await startPlayback({ uris: [tracks[0].uri] });
                alert(`Playing: ${tracks[0].name}`);
            } else {
                alert(`No tracks found for "${query}".`);
            }
        } catch (error) {
            console.error("Search failed:", error);
            setError("Search failed. Check console for details.");
        }
    };

    const playMyFirstPlaylist = async () => {
        if (!token || !playlists || playlists.items.length === 0) {
            alert("No playlists found or not logged in!");
            return;
        }
        try {
            setError(null);
            const firstPlaylist = playlists.items[0];
            const firstPlaylistUri = firstPlaylist.uri;
            await startPlayback({ context_uri: firstPlaylistUri });
            alert(`Playing your playlist: ${firstPlaylist.name}`);
        } catch (error) {
            console.error("Failed to play playlist:", error);
            setError("Failed to play playlist. Check console for details.");
        }
    };

    const pauseCurrentTrack = async () => {
        if (!token) return;
        try {
            setError(null);
            await pausePlayback();
            alert("Playback paused.");
        } catch (error) {
            console.error("Failed to pause:", error);
            setError("Failed to pause playback. Check console for details.");
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>React Spotify Player</h1>

                {!CLIENT_ID && (
                    <p style={{ color: "red" }}>
                        <b>Warning:</b> VITE_SPOTIFY_CLIENT_ID not set in .env
                        file!
                    </p>
                )}
                {error && <p className="error">Error: {error}</p>}

                {!token ? (
                    <button onClick={handleLogin}>Login to Spotify</button>
                ) : (
                    <div>
                        <button onClick={handleLogout}>Logout</button>
                        <hr />

                        {profile && (
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
                            </div>
                        )}

                        <div className="controls">
                            <button onClick={searchForTrack}>
                                Search & Play Track
                            </button>
                            <button
                                onClick={playMyFirstPlaylist}
                                disabled={
                                    !playlists || playlists.items.length === 0
                                }
                            >
                                Play My First Playlist
                            </button>
                            <button onClick={pauseCurrentTrack}>
                                Pause Playback
                            </button>
                        </div>

                        {playlists && playlists.items.length > 0 && (
                            <div className="playlists">
                                <h3>Your Playlists:</h3>
                                <ul>
                                    {playlists.items.map((playlist) => (
                                        <li key={playlist.id}>
                                            {playlist.name} (
                                            {playlist.tracks.total} tracks)
                                            {/* Add a button to play this specific playlist */}
                                            {/* <button onClick={() => startPlayback({ context_uri: playlist.uri })}>Play</button> */}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {playlists && playlists.items.length === 0 && (
                            <p>You have no playlists.</p>
                        )}
                    </div>
                )}
            </header>
        </div>
    );
}

export default App;
