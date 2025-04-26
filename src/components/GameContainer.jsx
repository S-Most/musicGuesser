// src/components/GameContainer.jsx
import React, { useState, useEffect, useCallback } from 'react';
import SetupScreen from './game/SetupScreen';
import GameScreen from './game/GameScreen';
import TimelinesDisplay from './game/TimelinesDisplay';
import GameOverScreen from './game/GameOverScreen';
import { getGameTracksFromPlaylist } from '../spotifyApi'; // Adjust path if needed
import { shuffleArray, parseRange, generateOptions } from '../utils/gameUtils'; // Adjust path

const MAX_PLAYERS = 4;
const PREDEFINED_PLAYLIST_ID = "4FqSergRQbPSWytDdtFfBb"; // Your playlist ID

function GameContainer({ onLogout }) { // Receive onLogout prop
    const [gameState, setGameState] = useState('setup'); // 'setup', 'playing', 'gameover'
    const [players, setPlayers] = useState([]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [currentSongIndex, setCurrentSongIndex] = useState(0);
    const [currentPlaylist, setCurrentPlaylist] = useState([]);
    const [currentSong, setCurrentSong] = useState(null);
    const [placementOptions, setPlacementOptions] = useState([]);
    const [feedback, setFeedback] = useState({ message: '', type: '' }); // type: 'correct', 'incorrect', 'error'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- Setup Phase ---
    const handleAddPlayer = useCallback((name) => {
        if (players.length >= MAX_PLAYERS) return;
        if (!name || players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            // Basic validation, can enhance UI feedback
            setError(players.some(p => p.name.toLowerCase() === name.toLowerCase())
                ? "Player name already exists."
                : "Please enter a valid player name.");
            setTimeout(() => setError(null), 3000); // Clear error after 3s
            return;
        }
        setPlayers(prev => [...prev, { name: name, score: 0, timeline: [] }]);
        setError(null); // Clear error on success
    }, [players]);

    // --- Game Start ---
    const handleStartGame = useCallback(async () => {
        if (players.length === 0) return;
        setIsLoading(true);
        setError(null);
        try {
            console.log("Starting game, fetching playlist...");
            const tracks = await getGameTracksFromPlaylist(PREDEFINED_PLAYLIST_ID);
            if (tracks.length < players.length + 1) { // Need at least 1 card per player + 1 to guess
                throw new Error("Not enough valid tracks in the playlist to start the game.");
            }
            const shuffledTracks = shuffleArray(tracks);

            // Give each player a starting card
            const initialPlayers = players.map(player => ({
                ...player,
                score: 0, // Reset score
                timeline: [shuffledTracks.pop()] // Give one card from the end
            }));
            setPlayers(initialPlayers);
            setCurrentPlaylist(shuffledTracks); // Remaining cards are the deck
            setCurrentSongIndex(0);
            setCurrentPlayerIndex(0);
            setGameState('playing');
            console.log("Game started!");
        } catch (err) {
            console.error("Failed to start game:", err);
            setError(`Failed to start game: ${err.message}. Check console.`);
            setGameState('setup'); // Go back to setup on error
        } finally {
            setIsLoading(false);
        }
    }, [players]);

    // --- Game Logic ---
    useEffect(() => {
        // Effect to set the current song and placement options when state indicates 'playing'
        if (gameState === 'playing' && currentPlaylist.length > 0 && currentSongIndex < currentPlaylist.length) {
            const song = currentPlaylist[currentSongIndex];
            const currentPlayer = players[currentPlayerIndex];
            setCurrentSong(song);
            setPlacementOptions(generateOptions(currentPlayer.timeline));
            setFeedback({ message: '', type: '' }); // Clear feedback for new turn
        } else if (gameState === 'playing' && currentPlaylist.length > 0 && currentSongIndex >= currentPlaylist.length) {
            // All songs from the playlist have been played
            setGameState('gameover');
        }
    }, [gameState, currentPlaylist, currentSongIndex, currentPlayerIndex, players]); // Dependencies

    // --- Guess Handling ---
    const handleGuessSubmit = useCallback((guessData) => {
        const { guessedTitle, guessedArtist, selectedRangeValue } = guessData;

        if (!currentSong) return; // Should not happen in 'playing' state

        const correctTitle = currentSong.title.toLowerCase();
        const correctArtist = currentSong.artist.toLowerCase();
        const correctYear = currentSong.year;

        const { start: rangeStart, end: rangeEnd } = parseRange(selectedRangeValue);

        // Fuzzy matching could be added here if desired
        const isTitleCorrect = guessedTitle.toLowerCase() === correctTitle;
        const isArtistCorrect = guessedArtist.toLowerCase() === correctArtist;
        // Check if the correct year falls within the selected range
        const isYearCorrectlyPlaced = correctYear >= rangeStart && correctYear <= rangeEnd;

        let turnScore = 0;
        let feedbackText = `The song was: ${currentSong.title} by ${currentSong.artist} (${currentSong.year}). `;
        let feedbackType = "incorrect";
        let correctPlacement = false;

        if (isTitleCorrect && isArtistCorrect && isYearCorrectlyPlaced) {
            feedbackText += "Perfect guess and placement!";
            feedbackType = "correct";
            turnScore = 3; // Example scoring
            correctPlacement = true;
        } else if (isTitleCorrect && isArtistCorrect && !isYearCorrectlyPlaced) {
            feedbackText += `Correct song, but wrong placement. Year ${correctYear} doesn't fit in '${selectedRangeValue}'.`;
            turnScore = 1; // Score for correct song ID
        } else if (isYearCorrectlyPlaced) {
            feedbackText += `Incorrect song, but correct placement!`;
            turnScore = 1; // Score for correct placement only
            correctPlacement = true;
        } else {
            feedbackText += "Incorrect song and placement.";
        }

        // Update player state immutably
        setPlayers(prevPlayers => {
            const newPlayers = [...prevPlayers];
            const playerToUpdate = { ...newPlayers[currentPlayerIndex] };
            playerToUpdate.score += turnScore;
            if (correctPlacement) {
                // Add card to timeline and re-sort
                playerToUpdate.timeline = [...playerToUpdate.timeline, currentSong].sort((a, b) => a.year - b.year);
            }
            newPlayers[currentPlayerIndex] = playerToUpdate;
            return newPlayers;
        });

        setFeedback({ message: feedbackText, type: feedbackType });

        // Timeout to show feedback, then advance turn
        setTimeout(() => {
            // Advance player index
            const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
            setCurrentPlayerIndex(nextPlayerIndex);
            // If it's the first player's turn again, advance the song
            if (nextPlayerIndex === 0) {
                setCurrentSongIndex(prev => prev + 1);
            }
            // The useEffect hook will handle setting the next song/options or ending the game
        }, feedbackType === "correct" ? 3000 : 4500);

    }, [currentSong, currentPlayerIndex, players]); // Dependencies

    // --- Reset Game ---
    const handlePlayAgain = useCallback(() => {
        setPlayers([]);
        setCurrentPlaylist([]);
        setCurrentSong(null);
        setCurrentPlayerIndex(0);
        setCurrentSongIndex(0);
        setFeedback({ message: '', type: '' });
        setError(null);
        setGameState('setup');
    }, []);

    // --- Render Logic ---
    const renderGameState = () => {
        switch (gameState) {
            case 'setup':
                return (
                    <SetupScreen
                        players={players}
                        maxPlayers={MAX_PLAYERS}
                        onAddPlayer={handleAddPlayer}
                        onStartGame={handleStartGame}
                        isLoading={isLoading}
                        error={error}
                    />
                );
            case 'playing':
                if (!currentSong || players.length === 0) {
                    return <p>Loading game...</p>; // Or a better loading indicator
                }
                return (
                    <>
                        <GameScreen
                            currentPlayer={players[currentPlayerIndex]}
                            currentSong={currentSong}
                            placementOptions={placementOptions}
                            onSubmitGuess={handleGuessSubmit}
                            feedback={feedback}
                            isLoading={isLoading} // Pass loading state for submit button disable
                        />
                        <TimelinesDisplay players={players} />
                    </>
                );
            case 'gameover':
                return (
                    <GameOverScreen
                        players={players}
                        onPlayAgain={handlePlayAgain}
                    />
                );
            default:
                return <p>Something went wrong.</p>;
        }
    };

    return (
        <div className="game-container">
            <button onClick={onLogout} style={{ float: 'right', marginBottom: '10px' }}>Logout</button>
            {renderGameState()}
        </div>
    );
}

export default GameContainer;