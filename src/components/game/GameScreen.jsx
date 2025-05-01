import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startPlayback, pausePlayback } from '../../spotifyApi';

const SNIPPET_DURATION_MS = 15000;
const REPLAY_PENALTY = 1;

function GameScreen({
    currentPlayer,
    currentSong,
    placementOptions,
    onSubmitGuess,
    isLoading,
    onAdvanceTurn,
}) {
    const [guessTitle, setGuessTitle] = useState('');
    const [guessArtist, setGuessArtist] = useState('');
    const [guessRange, setGuessRange] = useState('');
    const [isSnippetPlaying, setIsSnippetPlaying] = useState(false);
    const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
    const [playbackError, setPlaybackError] = useState(null);
    const [snippetPlayCount, setSnippetPlayCount] = useState(0);
    const pauseTimeoutRef = useRef(null);


    const [feedbackData, setFeedbackData] = useState(null);
    const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);


    useEffect(() => {
        if (!isFeedbackVisible) {
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
    }, [currentSong, currentPlayer, isFeedbackVisible]);

     useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && isFeedbackVisible) {
                handleFeedbackDismiss();
            }
        };
        if (isFeedbackVisible) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFeedbackVisible]);


    const handlePlaySnippet = async () => {
        if (!currentSong || !currentSong.uri || isPlaybackLoading || isSnippetPlaying || isLoading || isFeedbackVisible) return;

        setPlaybackError(null);
        setIsPlaybackLoading(true);

        if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
        }

        try {
            const playbackOptions = snippetPlayCount === 0
                ? { uris: [currentSong.uri] }
                : {};
            await startPlayback(playbackOptions);
            setIsSnippetPlaying(true);
            setSnippetPlayCount(prevCount => prevCount + 1);

            pauseTimeoutRef.current = setTimeout(async () => {
                try {
                    await pausePlayback();
                } catch (pauseErr) {
                    console.error("Failed to auto-pause playback:", pauseErr);
                } finally {
                     setIsSnippetPlaying(false);
                     setIsPlaybackLoading(false);
                     pauseTimeoutRef.current = null;
                }
            }, SNIPPET_DURATION_MS);

        } catch (error) {
            console.error("Failed to start/resume playback:", error);
            let userError = "Failed to start/resume playback.";
            if (error.response?.status === 404) userError = "No active Spotify device found. Please ensure Spotify is active.";
            else if (error.response?.status === 403) userError = "Playback restricted (Premium required?).";
            else if (error.response?.status === 401) userError = "Authentication error. Please log out and back in.";
            setPlaybackError(userError);
            setIsSnippetPlaying(false);
            setIsPlaybackLoading(false);
             if (pauseTimeoutRef.current) {
                clearTimeout(pauseTimeoutRef.current);
                pauseTimeoutRef.current = null;
            }
        }
    };

    const handleFeedbackDismiss = useCallback(() => {
        setIsFeedbackVisible(false);
        setFeedbackData(null);
        onAdvanceTurn();
    }, [onAdvanceTurn]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!guessTitle || !guessArtist || !guessRange || isLoading || isFeedbackVisible) {
            if (!guessTitle || !guessArtist || !guessRange) {
                 alert("Please fill all guess fields and select a placement.");
            }
            return;
        }

        if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
        if (isSnippetPlaying) {
            pausePlayback().catch(err => console.warn("Failed to pause on submit:", err)).finally(() => setIsSnippetPlaying(false));
        }

        const feedbackResult = await onSubmitGuess({
            guessTitle,
            guessArtist,
            selectedRangeValue: guessRange,
            playCount: snippetPlayCount,
        });

        //
        if (feedbackResult) {
            setFeedbackData(feedbackResult);
            setIsFeedbackVisible(true);
        }


    }, [guessTitle, guessArtist, guessRange, isSnippetPlaying, snippetPlayCount, onSubmitGuess, isLoading, isFeedbackVisible]);


    let playButtonText = 'Play Song Snippet';
    if (isSnippetPlaying) playButtonText = 'Playing...';
    else if (isPlaybackLoading) playButtonText = 'Loading Snippet...';
    else if (snippetPlayCount > 0) playButtonText = `Continue playing (-${REPLAY_PENALTY}pt)`;

    const isAnyLoading = isLoading || isPlaybackLoading;
    const isInteractionDisabled = isAnyLoading || isFeedbackVisible;

    const isCorrectFeedback = feedbackData?.type === 'correct';


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
                ) : (
                    <p className="error">Error: Song URI is missing.</p>
                )}
                {playbackError && !isFeedbackVisible && <p className="error" style={{ marginTop: '10px' }}>{playbackError}</p>}
            </div>

            <form id="guess-area" onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                <h3>Your Guess:</h3>
                <label htmlFor="guess-title">Song Title:</label>
                <input
                    type="text" id="guess-title" placeholder="Enter Song Title"
                    value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)}
                    disabled={isInteractionDisabled}
                />
                <label htmlFor="guess-artist">Artist:</label>
                <input
                    type="text" id="guess-artist" placeholder="Enter Artist Name"
                    value={guessArtist} onChange={(e) => setGuessArtist(e.target.value)}
                    disabled={isInteractionDisabled}
                />
                <label htmlFor="guess-year-range">Place card:</label>
                <select
                    id="guess-year-range" value={guessRange}
                    onChange={(e) => setGuessRange(e.target.value)}
                    disabled={isInteractionDisabled}
                    required
                >
                    <option value="" disabled>-- Select Placement --</option>
                    {placementOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.text}</option>
                    ))}
                </select>
                <button
                    id="submit-guess-button" type="submit"
                    disabled={isInteractionDisabled || !guessTitle || !guessArtist || !guessRange || isSnippetPlaying}
                >
                    {isLoading ? 'Submitting...' : 'Submit Guess'}
                </button>
            </form>

            {isFeedbackVisible && feedbackData && (
                <div className="dialog-overlay" onClick={handleFeedbackDismiss}>
                    <div className="dialog-box feedback-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className={`feedback-content ${isCorrectFeedback ? 'feedback-correct' : 'feedback-incorrect'}`}>
                            <span className="feedback-icon">
                                {isCorrectFeedback ? '✅' : '❌'}
                            </span>
                            <div className="feedback-text-container">
                                <h3>{isCorrectFeedback ? 'Correct!' : 'Incorrect'}</h3>
                                <p id="feedback-message">
                                    {feedbackData.message}
                                </p>
                            </div>
                        </div>
                        <button className="dialog-confirm-button" onClick={handleFeedbackDismiss}>
                            Continue
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
export default GameScreen;