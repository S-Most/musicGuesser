import React from 'react';
import UserProfile from './UserProfile';
import PlaylistList from './PlaylistList';
import PlaybackControls from './PlaybackControls';

function AuthenticatedApp({
    profile,
    playlists,
    onLogout,
    onSearch,
    onPlayFirstPlaylist,
    onPause,
    isLoading,
    error
}) {
    const canPlayPlaylist = playlists && playlists.items.length > 0;

    return (
        <div className="user-content">
            <button onClick={onLogout} disabled={isLoading}>Logout</button>
            <hr />
            {error && <p className="error">Error: {error}</p>}

            <UserProfile profile={profile} />

            <PlaybackControls
                onSearch={onSearch}
                onPlayFirstPlaylist={onPlayFirstPlaylist}
                onPause={onPause}
                isLoading={isLoading}
                canPlayPlaylist={canPlayPlaylist}
            />

            <PlaylistList playlists={playlists} isLoading={isLoading} />
        </div>
    );
}

export default AuthenticatedApp;