import React, { useState, useEffect, useRef } from 'react';
import { startPlayback, pausePlayback } from '../../spotifyApi';
import "./GameScreen.css"

const SNIPPET_DURATION_MS = 15000;
const REPLAY_PENALTY = 1;

function GameScreen({ currentPlayer, currentSong, placementOptions, onSubmitGuess, feedback, isLoading }) {
    const [guessTitle, setGuessTitle] = useState('');
    const [guessArtist, setGuessArtist] = useState('');
    const [guessRange, setGuessRange] = useState('');
    const [isSnippetPlaying, setIsSnippetPlaying] = useState(false);
    const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
    const [playbackError, setPlaybackError] = useState(null);
    const [snippetPlayCount, setSnippetPlayCount] = useState(0);
    const pauseTimeoutRef = useRef(null);

    useEffect(() => {
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
        const wasPlaying = isSnippetPlaying;
        return () => {
             if (wasPlaying && pauseTimeoutRef.current) {
                clearTimeout(pauseTimeoutRef.current);
                pauseTimeoutRef.current = null;
            }
        };
    }, [currentSong]);

    const handlePlaySnippet = async () => {
        if (!currentSong || !currentSong.uri || isPlaybackLoading) return;

        setPlaybackError(null);
        setIsPlaybackLoading(true);
        setIsSnippetPlaying(true);

        if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
        }

        try {
            const playbackOptions = snippetPlayCount === 0
                ? { uris: [currentSong.uri] }
                : {};

            const action = snippetPlayCount === 0 ? 'Starting' : 'Resuming';
            console.log(`${action} URI: ${currentSong.uri} (Play count: ${snippetPlayCount + 1})`);

            await startPlayback(playbackOptions);
            console.log(`Playback ${action.toLowerCase()} successful for ${currentSong.title}. Setting pause timer.`);

            setSnippetPlayCount(prevCount => prevCount + 1);

            pauseTimeoutRef.current = setTimeout(async () => {
                console.log(`Timer finished for ${currentSong.title}. Pausing playback.`);
                try {
                    await pausePlayback();
                    setIsSnippetPlaying(false);
                    pauseTimeoutRef.current = null;
                    console.log("Playback paused via timer.");
                } catch (pauseErr) {
                    console.error("Failed to auto-pause playback:", pauseErr);
                    setIsSnippetPlaying(false);
                    pauseTimeoutRef.current = null;
                }
                 setIsPlaybackLoading(false);

            }, SNIPPET_DURATION_MS);

        } catch (error) {
            console.error("Failed to start/resume playback:", error);
            let userError = "Failed to start/resume playback.";
            if (error.response?.status === 404) {
                userError = "No active Spotify device found, or nothing to resume. Please ensure Spotify is active.";
            } else if (error.response?.status === 403) {
                 userError = "Playback restricted. Do you have Spotify Premium? Is the device available?";
            } else if (error.response?.status === 401) {
                 userError = "Authentication error. Please log out and back in.";
            }
            setPlaybackError(userError);
            setIsSnippetPlaying(false);
            setIsPlaybackLoading(false);
            if (pauseTimeoutRef.current) {
                clearTimeout(pauseTimeoutRef.current);
                pauseTimeoutRef.current = null;
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!guessTitle || !guessArtist || !guessRange) {
            alert("Please fill all guess fields and select a placement.");
            return;
        }
        if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
            pauseTimeoutRef.current = null;
            console.log("Guess submitted, clearing pause timer.");
        }
        if (isSnippetPlaying) {
            console.log("Pausing playback due to guess submission.");
            pausePlayback()
                .then(() => setIsSnippetPlaying(false))
                .catch(err => {
                    console.warn("Failed to pause playback on guess submission:", err);
                    setIsSnippetPlaying(false);
                });
        }
        onSubmitGuess({
            guessedTitle: guessTitle,
            guessedArtist: guessArtist,
            selectedRangeValue: guessRange,
            playCount: snippetPlayCount
        });
    };

    // Button text logic (remains the same)
    let playButtonText = 'Play Song Snippet';
    if (isSnippetPlaying) {
        playButtonText = 'Playing...';
    } else if (snippetPlayCount > 0) {
        playButtonText = `Replay Snippet (-${REPLAY_PENALTY}pt)`;
    }

    const isPlayButtonDisabled = !!feedback.message || isLoading || isPlaybackLoading || isSnippetPlaying || !currentSong?.uri;


    return (
        <section id="game-section">
            <div id="game-info">
                <p>Current Turn: <strong>{currentPlayer.name}</strong></p>
                <p>Score: <strong>{currentPlayer.score}</strong></p>
            </div>

            <div id="song-area">
                 <p style={{ fontStyle: 'italic', color: '#aaa', marginBottom: '15px' }}>
                    ℹ️ Click button below. Playback starts/resumes on your active Spotify device and pauses after {SNIPPET_DURATION_MS / 1000}s. Replaying costs points!
                 </p>
                {currentSong.uri ? (
                    <button onClick={handlePlaySnippet} disabled={isPlayButtonDisabled}>
                        {playButtonText}
                    </button>
                ) : (
                   <p className="error">Error: Song URI is missing for this track.</p>
                )}
                {playbackError && <p className="error" style={{ marginTop: '10px' }}>{playbackError}</p>}
            </div>

            <form id="guess-area" onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                 <h3>Your Guess:</h3>
                <label htmlFor="guess-title">Song Title:</label>
                <input
                    type="text" id="guess-title" placeholder="Enter Song Title"
                    value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)}
                    disabled={isLoading || !!feedback.message}
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
                     required
                >
                    <option value="" disabled>-- Select Placement --</option>
                    {placementOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.text}</option>
                    ))}
                </select>

                 <button
                    id="submit-guess-button" type="submit"
                    disabled={isLoading || !!feedback.message || !guessTitle || !guessArtist || !guessRange || isPlaybackLoading || isSnippetPlaying}
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