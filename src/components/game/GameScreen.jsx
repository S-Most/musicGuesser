import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startPlayback, pausePlayback } from '../../spotifyApi';
import FeedbackDialog from './FeedbackDialog'; // Import the new component

const SNIPPET_DURATION_MS = 15000;
const REPLAY_PENALTY = 1; // Keep penalty value for button text display

function GameScreen({
    currentPlayer,
    currentSong, // For the current turn's display/playback
    placementOptions,
    onSubmitGuess, // Function from GameContainer to process guess
    isLoading, // State from GameContainer
    onAdvanceTurn, // Function from GameContainer to advance turn
    feedbackTriggerData, // NEW prop from GameContainer: { currentSong, guessData, timelineStatus } or null
}) {
    // State for guess inputs
    const [guessTitle, setGuessTitle] = useState('');
    const [guessArtist, setGuessArtist] = useState('');
    const [guessRange, setGuessRange] = useState('');

    // State for playback control
    const [isSnippetPlaying, setIsSnippetPlaying] = useState(false);
    const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
    const [playbackError, setPlaybackError] = useState(null);
    const [snippetPlayCount, setSnippetPlayCount] = useState(0);
    const pauseTimeoutRef = useRef(null);

    // State to control dialog visibility
    const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

    // Effect to reset fields for a new turn (when currentSong changes AND dialog is not open)
     useEffect(() => {
        if (!isFeedbackDialogOpen) {
            setGuessTitle('');
            setGuessArtist('');
            setGuessRange('');
            setIsSnippetPlaying(false);
            setIsPlaybackLoading(false);
            setPlaybackError(null);
            setSnippetPlayCount(0);
            if (pauseTimeoutRef.current) {
                clearTimeout(pauseTimeoutRef.current);
                pauseTimeoutRef.current = null;
            }
        }
    }, [currentSong, currentPlayer, isFeedbackDialogOpen]); // Depend on dialog state

    // Effect to trigger dialog open when feedbackTriggerData arrives from GameContainer
    useEffect(() => {
        if (feedbackTriggerData && !isFeedbackDialogOpen) {
            setIsFeedbackDialogOpen(true);
        }
    }, [feedbackTriggerData, isFeedbackDialogOpen]);


    const handlePlaySnippet = async () => {
        if (!currentSong || !currentSong.uri || isPlaybackLoading || isSnippetPlaying || isLoading || isFeedbackDialogOpen) return;
        setPlaybackError(null);
        setIsPlaybackLoading(true);
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);

        try {
            const playbackOptions = snippetPlayCount === 0 ? { uris: [currentSong.uri] } : {};
            await startPlayback(playbackOptions);
            setIsSnippetPlaying(true);
            setSnippetPlayCount(prevCount => prevCount + 1);
            pauseTimeoutRef.current = setTimeout(async () => {
                try { await pausePlayback(); } catch (err) { console.error("Auto-pause failed:", err); }
                finally { setIsSnippetPlaying(false); setIsPlaybackLoading(false); pauseTimeoutRef.current = null; }
            }, SNIPPET_DURATION_MS);
        } catch (error) {
            console.error("Playback failed:", error);
            let userError = "Playback failed.";
            if (error.response?.status === 404) userError = "No active Spotify device.";
            else if (error.response?.status === 403) userError = "Playback restricted (Premium?).";
            else if (error.response?.status === 401) userError = "Auth error.";
            setPlaybackError(userError);
            setIsSnippetPlaying(false); setIsPlaybackLoading(false);
            if (pauseTimeoutRef.current) { clearTimeout(pauseTimeoutRef.current); pauseTimeoutRef.current = null; }
        }
    };

    // Callback for when the feedback dialog is closed by the user
    const handleFeedbackDialogClose = useCallback(() => {
        setIsFeedbackDialogOpen(false);
        onAdvanceTurn(); // Tell GameContainer to proceed
    }, [onAdvanceTurn]);

    // Handle submitting the guess form
    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        if (!guessTitle || !guessArtist || !guessRange || isLoading || isFeedbackDialogOpen) {
            if(!guessTitle || !guessArtist || !guessRange) alert("Please fill all fields.");
            return;
        }
        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
        if (isSnippetPlaying) pausePlayback().catch(err => console.warn("Pause fail:", err)).finally(() => setIsSnippetPlaying(false));

        // Call GameContainer's function. It will set isLoading and eventually feedbackTriggerData
        onSubmitGuess({
            guessTitle,
            guessArtist,
            selectedRangeValue: guessRange,
            playCount: snippetPlayCount,
        });

    }, [guessTitle, guessArtist, guessRange, isSnippetPlaying, snippetPlayCount, onSubmitGuess, isLoading, isFeedbackDialogOpen]);


    let playButtonText = 'Play Song Snippet';
    if (isSnippetPlaying) playButtonText = 'Playing...';
    else if (isPlaybackLoading) playButtonText = 'Loading Snippet...';
    else if (snippetPlayCount > 0) playButtonText = `Continue playing (-${REPLAY_PENALTY}pt)`;

    const isInteractionDisabled = isLoading || isPlaybackLoading || isFeedbackDialogOpen;

    return (
        <section id="game-section">
            <div id="game-info">
                <p>Current Turn: <strong>{currentPlayer.name}</strong></p>
                {isLoading && <p className="loading" style={{ margin: '10px 0' }}>Processing guess...</p>}
            </div>

            <div id="song-area">
                {currentSong.uri ? (
                    <button onClick={handlePlaySnippet} disabled={isInteractionDisabled || isSnippetPlaying || !currentSong?.uri}>
                        {playButtonText}
                    </button>
                ) : <p className="error">Error: Song URI missing.</p>}
                {playbackError && !isFeedbackDialogOpen && <p className="error" style={{ marginTop: '10px' }}>{playbackError}</p>}
            </div>

            <form id="guess-area" onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                <h3>Your Guess:</h3>
                <label htmlFor="guess-title">Song Title:</label>
                <input type="text" id="guess-title" placeholder="Enter Song Title" value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)} disabled={isInteractionDisabled} />
                <label htmlFor="guess-artist">Artist:</label>
                <input type="text" id="guess-artist" placeholder="Enter Artist Name" value={guessArtist} onChange={(e) => setGuessArtist(e.target.value)} disabled={isInteractionDisabled} />
                <label htmlFor="guess-year-range">Place card:</label>
                <select id="guess-year-range" value={guessRange} onChange={(e) => setGuessRange(e.target.value)} disabled={isInteractionDisabled} required>
                    <option value="" disabled>-- Select Placement --</option>
                    {placementOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.text}</option>))}
                </select>
                <button id="submit-guess-button" type="submit" disabled={isInteractionDisabled || !guessTitle || !guessArtist || !guessRange || isSnippetPlaying}>
                    {isLoading ? 'Submitting...' : 'Submit Guess'}
                </button>
            </form>

            {/* Render the Feedback Dialog */}
            <FeedbackDialog
                isOpen={isFeedbackDialogOpen}
                currentSong={feedbackTriggerData?.currentSong} // Pass data from trigger
                guessData={feedbackTriggerData?.guessData}
                timelineStatus={feedbackTriggerData?.timelineStatus}
                onClose={handleFeedbackDialogClose}
            />
        </section>
    );
}
export default GameScreen;