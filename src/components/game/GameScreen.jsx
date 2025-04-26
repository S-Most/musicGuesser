import React, { useState, useRef, useEffect } from 'react';

function GameScreen({ currentPlayer, currentSong, placementOptions, onSubmitGuess, feedback, isLoading }) {
    const [guessTitle, setGuessTitle] = useState('');
    const [guessArtist, setGuessArtist] = useState('');
    const [guessRange, setGuessRange] = useState('');
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const audioRef = useRef(null); // Ref to control the audio element

     // Reset inputs when the song changes
    useEffect(() => {
        setGuessTitle('');
        setGuessArtist('');
        setGuessRange('');
         // Stop audio if it was playing for the previous song
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlayingPreview(false);
        }
    }, [currentSong]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!guessTitle || !guessArtist || !guessRange) {
             alert("Please fill all guess fields and select a placement.");
             return;
        }
         if (audioRef.current) audioRef.current.pause(); // Stop audio on guess
         setIsPlayingPreview(false);
        onSubmitGuess({
            guessedTitle: guessTitle,
            guessedArtist: guessArtist,
            selectedRangeValue: guessRange
        });
    };

     const togglePlayPreview = () => {
        if (!audioRef.current) return;
        if (isPlayingPreview) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(err => console.error("Audio play failed:", err));
        }
        setIsPlayingPreview(!isPlayingPreview);
    };

    // Handle audio ending naturally
    useEffect(() => {
        const audioElement = audioRef.current;
        const handleAudioEnd = () => setIsPlayingPreview(false);
        if (audioElement) {
            audioElement.addEventListener('ended', handleAudioEnd);
            return () => audioElement.removeEventListener('ended', handleAudioEnd); // Cleanup listener
        }
    }, []);

    return (
        <section id="game-section">
            <h2>Game On!</h2>
            <div id="game-info">
                <p>Current Turn: <strong>{currentPlayer.name}</strong></p>
                <p>Score: <strong>{currentPlayer.score}</strong></p>
            </div>

             <div id="song-area">
                <p>Listen to the preview:</p>
                 {currentSong.previewUrl ? (
                     <>
                         <audio ref={audioRef} src={currentSong.previewUrl} preload="auto" />
                         <button onClick={togglePlayPreview} disabled={isLoading}>
                             {isPlayingPreview ? 'Pause Preview' : 'Play Preview'}
                         </button>
                     </>
                 ) : (
                    <p className="error">No audio preview available for this track.</p>
                 )}
             </div>

            <form id="guess-area" onSubmit={handleSubmit}>
                <h3>Your Guess:</h3>
                <label htmlFor="guess-title">Song Title:</label>
                <input
                    type="text" id="guess-title" placeholder="Enter Song Title"
                    value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)}
                    disabled={isLoading || !!feedback.message} // Disable after guess submitted
                />

                <label htmlFor="guess-artist">Artist:</label>
                <input
                    type="text" id="guess-artist" placeholder="Enter Artist Name"
                    value={guessArtist} onChange={(e) => setGuessArtist(e.target.value)}
                     disabled={isLoading || !!feedback.message}
                />

                <label htmlFor="guess-year-range">Place card:</label>
                <select
                    id="guess-year-range" value={guessRange}
                    onChange={(e) => setGuessRange(e.target.value)}
                     disabled={isLoading || !!feedback.message}
                     required // Make selection mandatory
                >
                    <option value="" disabled>-- Select Placement --</option>
                    {placementOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.text}</option>
                    ))}
                </select>

                <button
                    id="submit-guess-button" type="submit"
                    disabled={isLoading || !!feedback.message || !guessTitle || !guessArtist || !guessRange}
                 >
                    Submit Guess
                </button>
            </form>

            {feedback.message && (
                 <div id="feedback-area">
                    <p id="feedback-message" className={feedback.type}>
                        {feedback.message}
                    </p>
                 </div>
            )}
        </section>
    );
}
export default GameScreen;