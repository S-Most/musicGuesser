import React, { useState } from 'react';

function SetupScreen({
    players,
    maxPlayers,
    userPlaylists,
    selectedPlaylistId,
    onAddPlayer,
    onPlaylistSelect,
    onStartGame,
    isLoading,
    error
}) {
    const [playerName, setPlayerName] = useState('');

    const handleAddClick = () => {
        onAddPlayer(playerName);
        setPlayerName('');
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleAddClick();
        }
    };

    const canAddPlayer = players.length < maxPlayers;

    return (
        <section id="setup-section">
            <h2>Setup New Game</h2>
            {error && <p className="error">{error}</p>}

            <div id="playlist-selection-area" style={{ marginBottom: '20px' }}>
                <h3>Select Playlist</h3>
                {userPlaylists.total > 0 ? (
                    <select
                        id="playlist-select"
                        value={selectedPlaylistId}
                        onChange={(e) => onPlaylistSelect(e.target.value)}
                        disabled={isLoading}
                        required
                    >
                        <option value="" disabled>-- Choose a Playlist --</option>
                        {userPlaylists.items.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                                {playlist.name} ({playlist.tracks.total} tracks)
                            </option>
                        ))}
                    </select>
                ) : isLoading ? (
                     <p>Loading playlists...</p>
                ) : (
                    <p className="error">No playlists found or failed to load.</p>
                )}
                 {userPlaylists.total > 50 && <p><small>Showing first 50 playlists.</small></p>}
            </div>

            <div id="player-setup-area">
                <h3>Add Players ({players.length}/{maxPlayers})</h3>
                <ul id="player-list">
                    {players.map((p, index) => <li key={index}>{p.name}</li>)}
                </ul>
                {canAddPlayer ? (
                    <div id="add-player-area" style={{ marginBottom: '10px' }}>
                        <input
                            type="text"
                            id="player-name"
                            placeholder="Enter Player Name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading}
                            maxLength={25}
                        />
                        <button
                             id="add-player-button"
                             onClick={handleAddClick}
                             disabled={isLoading || !playerName.trim()}
                             style={{ marginLeft: '5px'}}
                        >
                            Add Player
                        </button>
                    </div>
                ) : (
                     <p id="player-limit-message" className="error">Maximum {maxPlayers} players reached.</p>
                )}
            </div>

            <button
                id="start-game-button"
                onClick={onStartGame}
                disabled={isLoading || players.length === 0 || !selectedPlaylistId}
                style={{ marginTop: '20px', padding: '12px 25px', fontSize: '1.1em' }}
            >
                {isLoading ? 'Starting...' : 'Start Game'}
            </button>
        </section>
    );
}
export default SetupScreen;