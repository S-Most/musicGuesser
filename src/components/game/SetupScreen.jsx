import React, { useState } from 'react';

function SetupScreen({ players, maxPlayers, onAddPlayer, onStartGame, isLoading, error }) {
    const [playerName, setPlayerName] = useState('');

    const handleAddClick = () => {
        onAddPlayer(playerName);
        setPlayerName(''); // Clear input after adding
    };

     const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleAddClick();
        }
    };

    const canAddPlayer = players.length < maxPlayers;

    return (
        <section id="setup-section">
            <h2>Setup Game</h2>
            {error && <p className="error">{error}</p>}
            {/* Session code could be added back here if needed */}
            <div id="player-setup-area">
                <h3>Players ({players.length}/{maxPlayers})</h3>
                <ul id="player-list">
                    {players.map((p, index) => <li key={index}>{p.name}</li>)}
                </ul>
                {canAddPlayer ? (
                    <div id="add-player-area">
                        <input
                            type="text"
                            id="player-name"
                            placeholder="Enter Player Name"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                             onKeyPress={handleKeyPress}
                            disabled={isLoading}
                        />
                        <button id="add-player-button" onClick={handleAddClick} disabled={isLoading || !playerName}>Add Player</button>
                    </div>
                ) : (
                     <p id="player-limit-message" className="error">Maximum {maxPlayers} players reached.</p>
                )}

                <p>Using a predefined playlist.</p>
                <button
                    id="start-game-button"
                    onClick={onStartGame}
                    disabled={isLoading || players.length === 0}
                >
                    {isLoading ? 'Loading...' : 'Start Game'}
                </button>
            </div>
        </section>
    );
}
export default SetupScreen;