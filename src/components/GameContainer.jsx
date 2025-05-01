/* eslint-disable no-useless-escape */
import React, { useState, useEffect, useCallback } from "react";
import SetupScreen from "./game/SetupScreen";
import GameScreen from "./game/GameScreen";
import TimelinesDisplay from "./game/TimelinesDisplay";
import GameOverScreen from "./game/GameOverScreen";
import FeedbackDialog from "./game/FeedbackDialog"; // Import FeedbackDialog here
import { getUserPlaylists, getPlaylistItems } from "../spotifyApi";
import { shuffleArray, parseRange, generateOptions } from "../utils/gameUtils";

const MAX_PLAYERS = 4;
const MAX_TIMELINE_LENGTH = 10;
const REPLAY_PENALTY = 1;

function GameContainer({ onLogout }) {
    const [gameState, setGameState] = useState("setup");
    const [players, setPlayers] = useState([]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [currentSongIndex, setCurrentSongIndex] = useState(0);
    const [userPlaylists, setUserPlaylists] = useState({ items: [], total: 0 });
    const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
    const [currentPlaylistDeck, setCurrentPlaylistDeck] = useState([]);
    const [currentSong, setCurrentSong] = useState(null); // Song for the current turn
    const [placementOptions, setPlacementOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // State to hold data needed for the feedback dialog
    const [feedbackTriggerData, setFeedbackTriggerData] = useState(null); // { currentSong, guessData, timelineStatus }

    useEffect(() => {
        const fetchPlaylists = async () => {
            setError(null);
            try {
                const playlistsData = await getUserPlaylists(50);
                setUserPlaylists(playlistsData);
            } catch (err) {
                console.error("Playlist fetch failed:", err);
                setError("Could not load playlists.");
                if (err.response?.status === 401) onLogout();
            }
        };
        fetchPlaylists();
    }, [onLogout]);

    const handleAddPlayer = useCallback(
        (name) => {
            if (players.length >= MAX_PLAYERS) {
                setError(`Max ${MAX_PLAYERS} players.`);
                setTimeout(() => setError(null), 3000);
                return;
            }
            if (
                !name.trim() ||
                players.some(
                    (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
                )
            ) {
                setError(
                    players.some(
                        (p) =>
                            p.name.toLowerCase() === name.trim().toLowerCase(),
                    )
                        ? "Name exists."
                        : "Invalid name.",
                );
                setTimeout(() => setError(null), 3000);
                return;
            }
            setPlayers((prev) => [
                ...prev,
                { name: name.trim(), score: 0, timeline: [] },
            ]);
            setError(null);
        },
        [players],
    );

    const handlePlaylistSelect = (playlistId) => {
        setSelectedPlaylistId(playlistId);
        setError(null);
    };

    const processTracks = (items) => {
        if (!items || items.length === 0) return [];
        const tracks = items.map((item) => item.track).filter(Boolean);
        const validTracks = tracks.filter(
            (t) =>
                t?.album?.release_date &&
                t?.uri &&
                /^\d{4}(-\d{2}(-\d{2})?)?$/.test(t.album.release_date),
        );
        return validTracks
            .map((t) => ({
                id: t.id,
                title: t.name,
                artist: t.artists?.[0]?.name || "Unknown",
                year: parseInt(t.album.release_date.substring(0, 4), 10),
                albumArt: t.album.images?.[0]?.url,
                uri: t.uri,
            }))
            .filter((t) => !isNaN(t.year));
    };

    const handleStartGame = useCallback(async () => {
        if (players.length === 0 || !selectedPlaylistId) {
            setError(
                players.length === 0 ? "Add players." : "Select playlist.",
            );
            setTimeout(() => setError(null), 3000);
            return;
        }
        setIsLoading(true);
        setError(null);
        setFeedbackTriggerData(null); // Clear any old feedback
        try {
            let allTracks = [],
                offset = 0,
                limit = 50,
                totalFetched = 0,
                playlistTotal = 0;
            do {
                const data = await getPlaylistItems(
                    selectedPlaylistId,
                    limit,
                    offset,
                );
                if (!data || !data.items) {
                    if (offset === 0)
                        throw new Error("Playlist empty/fetch fail.");
                    else break;
                }
                playlistTotal = data.total;
                allTracks = allTracks.concat(processTracks(data.items));
                offset += data.items.length;
                totalFetched += data.items.length;
                if (data.items.length === 0 && totalFetched < playlistTotal)
                    break;
                if (totalFetched >= 500) break;
            } while (totalFetched < playlistTotal);
            if (allTracks.length < players.length + 1)
                throw new Error(
                    `Not enough valid tracks (${allTracks.length}). Min ${
                        players.length + 1
                    } needed.`,
                );
            const deck = shuffleArray(allTracks);
            const initialPlayers = players.map((p) => ({
                ...p,
                score: 0,
                timeline: [deck.pop()],
            }));
            setPlayers(initialPlayers);
            setCurrentPlaylistDeck(deck);
            setCurrentSongIndex(0);
            setCurrentPlayerIndex(0);
            setGameState("playing");
        } catch (err) {
            console.error("Start game failed:", err);
            setError(`Start failed: ${err.message}`);
            setGameState("setup");
            if (err.response?.status === 401) onLogout();
        } finally {
            setIsLoading(false);
        }
    }, [players, selectedPlaylistId, onLogout]);

    // Effect to set current song for the turn
    useEffect(() => {
        if (gameState === "playing" && currentPlaylistDeck.length > 0) {
            const song = currentPlaylistDeck[currentSongIndex];
            const player = players[currentPlayerIndex];
            if (song && player) {
                setCurrentSong(song); // Set the song for GameScreen to use
                setPlacementOptions(generateOptions(player.timeline));
            } else {
                // This case should ideally be caught by game over logic
                console.warn(
                    "Attempted to set song/player when state is invalid or game might be over.",
                );
            }
        }
    }, [
        gameState,
        currentPlaylistDeck,
        currentSongIndex,
        currentPlayerIndex,
        players,
    ]);

    // Function called AFTER feedback dialog is closed in GameScreen
    const handleAdvanceTurn = useCallback(() => {
        setIsLoading(false); // Turn off loading indicator
        setFeedbackTriggerData(null); // Clear the trigger data

        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        const nextSongIndex = currentSongIndex + 1;

        const isGameOver =
            nextSongIndex >= currentPlaylistDeck.length ||
            players.some((p) => p.timeline.length >= MAX_TIMELINE_LENGTH);

        if (isGameOver) {
            console.log("Game over.");
            setGameState("gameover");
            setCurrentSong(null); // Clear song for game over screen
        } else {
            setCurrentPlayerIndex(nextPlayerIndex);
            setCurrentSongIndex(nextSongIndex);
            // The useEffect above will set the new currentSong based on these indices
        }
    }, [
        currentPlayerIndex,
        currentSongIndex,
        players,
        currentPlaylistDeck.length,
    ]);

    // Function called by GameScreen when guess is submitted
    // Calculates score, updates player state, and sets data to trigger feedback dialog
    const handleGuessSubmit = useCallback(
        (guessData) => {
            // guessData: { guessedTitle, guessedArtist, selectedRangeValue, playCount }
            if (!currentSong) return; // Should not happen in playing state

            setIsLoading(true); // Indicate processing

            // --- Calculations (Simplified logic from previous step, as logic moved to Dialog) ---
            const correctYear = currentSong.year;
            const { start: rangeStart, end: rangeEnd } = parseRange(
                guessData.selectedRangeValue || "",
            );
            const isPlacementCorrect =
                correctYear >= rangeStart && correctYear <= rangeEnd;
            const isTitleCorrect =
                formatString(guessData.guessedTitle) ===
                formatString(currentSong.title);
            const isArtistCorrect =
                formatString(guessData.guessedArtist) ===
                formatString(currentSong.artist);
            const wasReplayed = guessData.playCount > 1;
            const isPerfectGuess =
                isTitleCorrect && isArtistCorrect && isPlacementCorrect;

            // --- Score Calculation ---
            let turnScore = 0;
            if (isPerfectGuess) turnScore = 3;
            else if (isTitleCorrect && isArtistCorrect) turnScore = 1;
            else if (isPlacementCorrect) turnScore = 1; // Score for placement even if ID wrong
            if (isPerfectGuess && wasReplayed)
                turnScore = Math.max(0, turnScore - REPLAY_PENALTY);

            // --- Update Player State and determine timeline status ---
            let cardAdded = false;
            let wasFull = false;
            setPlayers((prevPlayers) => {
                const newPlayers = [...prevPlayers];
                const playerToUpdate = { ...newPlayers[currentPlayerIndex] };
                playerToUpdate.score += turnScore;

                // Only add card if placement was correct
                if (isPlacementCorrect) {
                    if (playerToUpdate.timeline.length < MAX_TIMELINE_LENGTH) {
                        playerToUpdate.timeline = [
                            ...playerToUpdate.timeline,
                            currentSong,
                        ].sort((a, b) => a.year - b.year);
                        cardAdded = true;
                    } else {
                        wasFull = true;
                    }
                }
                newPlayers[currentPlayerIndex] = playerToUpdate;
                return newPlayers;
            });

            // --- Set data to trigger the feedback dialog in GameScreen ---
            setFeedbackTriggerData({
                currentSong: currentSong, // The song that was just guessed
                guessData: guessData, // The player's actual guess input
                timelineStatus: { cardAdded, wasFull }, // Status of the timeline update
            });

            // isLoading remains true until handleAdvanceTurn is called after dialog closure
        },
        [currentSong, currentPlayerIndex, players],
    );

    // Helper for string formatting (needed for score calculation)
    const formatString = (str) =>
        str
            ? str
                  .toLowerCase()
                  .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()']/g, "")
                  .replace(/\s+/g, " ")
                  .trim()
            : "";

    const handlePlayAgain = useCallback(() => {
        setPlayers([]);
        setCurrentPlaylistDeck([]);
        setCurrentSong(null);
        setCurrentPlayerIndex(0);
        setCurrentSongIndex(0);
        setSelectedPlaylistId("");
        setError(null);
        setGameState("setup");
        setIsLoading(false);
        setFeedbackTriggerData(null);
    }, []);

    const renderGameState = () => {
        switch (gameState) {
            case "setup":
                return (
                    <SetupScreen
                        players={players}
                        maxPlayers={MAX_PLAYERS}
                        userPlaylists={userPlaylists}
                        selectedPlaylistId={selectedPlaylistId}
                        onAddPlayer={handleAddPlayer}
                        onPlaylistSelect={handlePlaylistSelect}
                        onStartGame={handleStartGame}
                        isLoading={isLoading}
                        error={error}
                    />
                );
            case "playing":
                if (
                    !currentSong ||
                    players.length === 0 ||
                    !players[currentPlayerIndex]
                ) {
                    return <p className="loading">Loading game...</p>;
                }
                return (
                    <>
                        <GameScreen
                            currentPlayer={players[currentPlayerIndex]}
                            currentSong={currentSong} // Pass song for the current turn
                            placementOptions={placementOptions}
                            onSubmitGuess={handleGuessSubmit} // Pass guess processor
                            isLoading={isLoading} // Pass loading state
                            onAdvanceTurn={handleAdvanceTurn} // Pass turn advancer
                            feedbackTriggerData={feedbackTriggerData} // Pass data to trigger dialog
                        />
                        <TimelinesDisplay players={players} />
                    </>
                );
            case "gameover":
                return (
                    <GameOverScreen
                        players={players}
                        onPlayAgain={handlePlayAgain}
                    />
                );
            default:
                return <p>Unexpected error.</p>;
        }
    };

    return (
        <div className="game-container">
            <button
                onClick={onLogout}
                style={{
                    position: "fixed",
                    top: "10px",
                    right: "10px",
                    zIndex: 1001,
                }}
                disabled={isLoading && gameState !== "setup"}
            >
                Logout
            </button>
            <h1>Music Timeline Game</h1>
            {error && gameState === "setup" && (
                <p
                    className="error"
                    style={{ maxWidth: "600px", margin: "15px auto" }}
                >
                    {error}
                </p>
            )}
            {renderGameState()}
            {/* FeedbackDialog is now rendered *within* GameScreen */}
        </div>
    );
}

export default GameContainer;
