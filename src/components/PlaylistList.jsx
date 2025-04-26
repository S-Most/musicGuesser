import React from 'react';
import { startPlayback } from '../spotifyApi';

function PlaylistList({ playlists, isLoading }) {
    if (!playlists) {
        return <p>Loading playlists...</p>;
    }

    const handlePlayPlaylist = async (playlistUri) => {
        console.log("Attempting to play playlist:", playlistUri);
        try {
            // setIsLoading(true); // Would need setIsLoading prop
            await startPlayback({ context_uri: playlistUri });
            //  alert(`Attempting to play selected playlist.\n(Requires active Spotify device)`);
        } catch (e) {
            console.error("Failed to play playlist:", e);
            alert('Could not start playback. Ensure Spotify is active.');
            // setError("Failed to play playlist."); // Would need setError prop
        } finally {
            // setIsLoading(false);
        }
    };


    return (
        <div className="playlists">
            <h3>Your Playlists ({playlists.total}):</h3>
            {playlists.items.length > 0 ? (
                <ul>
                    {playlists.items.map((playlist) => (
                        <li key={playlist.id}>
                            {playlist.name} ({playlist.tracks.total} tracks)
                            <button
                                onClick={() => handlePlayPlaylist(playlist.uri)}
                                disabled={isLoading}
                                style={{ marginLeft: '10px', fontSize: '0.8em', padding: '2px 5px'}}
                            >
                                Play
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>You have no playlists.</p>
            )}
        </div>
    );
}

export default PlaylistList;