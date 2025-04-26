import React from 'react';
import './PlayerTimeline.css';

function PlayerTimeline({ player }) {
    return (
        <div className="player-timeline">
            <h4>
                {player.name} - Score: {player.score}
            </h4>

            <div className="timeline-entries-container">
                {player.timeline && player.timeline.length > 0 ? (
                    player.timeline.map((entry, index) => (
                        <div
                            key={entry.id || index}
                            className="timeline-entry"
                        >
                            <div className="timeline-year">{entry.year}</div>
                            <div className="timeline-info">
                                {entry.title} - {entry.artist}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="timeline-empty">Timeline empty</p>
                )}
            </div>
        </div>
    );
}
export default PlayerTimeline;