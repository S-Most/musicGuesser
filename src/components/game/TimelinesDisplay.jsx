import React from 'react';
import PlayerTimeline from './PlayerTimeline';
import "./TimelinesDisplay.css";

function TimelinesDisplay({ players }) {
    return (
        <section className="timelines-section">
            <div className="timelines-container">
                {players.map((player, index) => (
                    <PlayerTimeline key={index} player={player} />
                ))}
            </div>
        </section>
    );
}
export default TimelinesDisplay;