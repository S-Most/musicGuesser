import React from 'react';

function PlayerTimeline({ player }) {
    return (
        <div className="player-timeline">
            <h4 className="timeline-header">
                <span className="timeline-player-name">{player.name}</span>
                <span className="timeline-player-score">Score: {player.score}</span>
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