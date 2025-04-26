import React from 'react';

function PlaybackControls({
    onSearch,
    onPlayFirstPlaylist,
    onPause,
    isLoading,
    canPlayPlaylist
}) {
    return (
        <div className="controls">
            <button onClick={onSearch} disabled={isLoading}>
                Search & Play Track
            </button>
            <button
                onClick={onPlayFirstPlaylist}
                disabled={isLoading || !canPlayPlaylist}
            >
                Play My First Playlist
            </button>
            <button onClick={onPause} disabled={isLoading}>
                Pause Playback
            </button>
        </div>
    );
}

export default PlaybackControls;