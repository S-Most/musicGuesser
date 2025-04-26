import React from 'react';
import PlayerTimeline from './PlayerTimeline';

function TimelinesDisplay({ players }) {
    return (
        <section className="timelines-section">
            <div className="timelines-container" style={{display: "grid", gap: ".5rem"}}>
                {players.map((player, index) => (
                    <PlayerTimeline key={index} player={player} />
                ))}
            </div>
        </section>
    );
}
export default TimelinesDisplay;