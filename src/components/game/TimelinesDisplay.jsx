import React from 'react';
import PlayerTimeline from './PlayerTimeline';

function TimelinesDisplay({ players }) {
    return (
        <section id="timelines-section">
            <h2>Player Timelines</h2>
            <div id="timelines-container">
                {players.map((player, index) => (
                    <PlayerTimeline key={index} player={player} />
                ))}
            </div>
        </section>
    );
}
export default TimelinesDisplay;