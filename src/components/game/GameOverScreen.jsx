import React from 'react';

function GameOverScreen({ players, onPlayAgain }) {
     const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    return (
        <section id="game-over-section">
            <h2>Game Over!</h2>
            <h3>Final Scores:</h3>
            <ul id="final-scores">
                 {sortedPlayers.map((p, index) => (
                    <li key={index}>{p.name}: {p.score}</li>
                 ))}
            </ul>
            <button id="play-again-button" onClick={onPlayAgain}>Play Again?</button>
        </section>
    );
}
export default GameOverScreen;