import React from 'react';

function PlayerTimeline({ player }) {
    return (
        <div className="player-timeline">
            <h4>{player.name}'s Timeline (Score: {player.score})</h4>
             {player.timeline && player.timeline.length > 0 ? (
                 player.timeline.map((entry, index) => (
                     <div key={entry.id || index} className="timeline-entry">
                         {entry.year}: {entry.title} - {entry.artist}
                     </div>
                 ))
             ) : (
                <p>Timeline empty</p>
             )}
        </div>
    );
}
export default PlayerTimeline;
