/* eslint-disable no-useless-escape */
import React, { useState, useEffect, useCallback } from "react";
import SetupScreen from "./game/SetupScreen";
import GameScreen from "./game/GameScreen";
import TimelinesDisplay from "./game/TimelinesDisplay";
import GameOverScreen from "./game/GameOverScreen";
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
    const [currentSong, setCurrentSong] = useState(null);
    const [placementOptions, setPlacementOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false); // Controls loading for guess processing & game start
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPlaylists = async () => {
            setError(null);
            try {
                const playlistsData = await getUserPlaylists(50);
                setUserPlaylists(playlistsData);
            } catch (err) {
                console.error("Failed to fetch playlists:", err);
                setError(
                    "Could not load your playlists. Please try refreshing.",
                );
                if (err.response?.status === 401) onLogout();
            }
        };
        fetchPlaylists();
    }, [onLogout]);

    const handleAddPlayer = useCallback(
        (name) => {
            if (players.length >= MAX_PLAYERS) {
                setError(`Maximum ${MAX_PLAYERS} players allowed.`);
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
                        ? "Player name already exists."
                        : "Please enter a valid player name.",
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
        const tracksOnly = items.map((item) => item.track).filter(Boolean);
        const filteredForData = tracksOnly.filter((track) => {
            const hasReleaseDate = !!track?.album?.release_date;
            const hasUri = !!track?.uri;
            const isValidFormat = /^\d{4}(-\d{2}(-\d{2})?)?$/.test(
                track?.album?.release_date,
            );
            return hasReleaseDate && hasUri && isValidFormat;
        });
        const mappedToGameFormat = filteredForData.map((track) => {
            const yearString = track.album.release_date.substring(0, 4);
            const year = parseInt(yearString, 10);
            return {
                id: track.id,
                title: track.name,
                artist: track.artists?.[0]?.name || "Unknown Artist",
                year: year,
                albumArt: track.album.images?.[0]?.url,
                uri: track.uri,
            };
        });
        return mappedToGameFormat.filter((track) => !isNaN(track.year));
    };

    const handleStartGame = useCallback(async () => {
        if (players.length === 0) {
            setError("Add at least one player.");
            setTimeout(() => setError(null), 3000);
            return;
        }
        if (!selectedPlaylistId) {
            setError("Select a playlist.");
            setTimeout(() => setError(null), 3000);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            let allTracks = [];
            let offset = 0;
            const limit = 50;
            let totalFetched = 0;
            let playlistTotal = 0;
            do {
                const playlistData = await getPlaylistItems(
                    selectedPlaylistId,
                    limit,
                    offset,
                );
                if (!playlistData || !playlistData.items) {
                    if (offset === 0)
                        throw new Error("Playlist empty/fetch failed.");
                    else break;
                }
                playlistTotal = playlistData.total;
                const processed = processTracks(playlistData.items);
                allTracks = allTracks.concat(processed);
                offset += playlistData.items.length;
                totalFetched += playlistData.items.length;
                if (
                    playlistData.items.length === 0 &&
                    totalFetched < playlistTotal
                )
                    break;
                if (totalFetched >= 500) break;
            } while (totalFetched < playlistTotal);

            if (allTracks.length < players.length + 1) {
                throw new Error(
                    `Not enough playable tracks (${
                        allTracks.length
                    }) found. Min ${players.length + 1} required.`,
                );
            }
            const shuffledTracks = shuffleArray(allTracks);
            const initialPlayers = players.map((player) => ({
                ...player,
                score: 0,
                timeline: [shuffledTracks.pop()],
            }));
            setPlayers(initialPlayers);
            setCurrentPlaylistDeck(shuffledTracks);
            setCurrentSongIndex(0);
            setCurrentPlayerIndex(0);
            setGameState("playing");
        } catch (err) {
            console.error("Failed to start game:", err);
            setError(`Failed to start: ${err.message}`);
            setGameState("setup");
            if (err.response?.status === 401) onLogout();
        } finally {
            setIsLoading(false);
        }
    }, [players, selectedPlaylistId, onLogout]);

    useEffect(() => {
        if (gameState === "playing" && currentPlaylistDeck.length > 0) {
            const isGameOver =
                currentSongIndex >= currentPlaylistDeck.length ||
                players.some((p) => p.timeline.length >= MAX_TIMELINE_LENGTH);
            if (isGameOver) {
                return;
            }
            const song = currentPlaylistDeck[currentSongIndex];
            const currentPlayer = players[currentPlayerIndex];
            if (song && currentPlayer) {
                setCurrentSong(song);
                setPlacementOptions(generateOptions(currentPlayer.timeline));
            } else if (!isGameOver) {
                console.error("Error setting current song/player state.");
                setError("Turn setup error. Returning to setup.");
                setGameState("setup");
            }
        }
    }, [
        gameState,
        currentPlaylistDeck,
        currentSongIndex,
        currentPlayerIndex,
        players,
    ]);


    const handleAdvanceTurn = useCallback(() => {
        setIsLoading(false);
        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        const nextSongIndex = currentSongIndex + 1;

        const isGameOver =
            nextSongIndex >= currentPlaylistDeck.length ||
            players.some((p) => p.timeline.length >= MAX_TIMELINE_LENGTH);

        if (isGameOver) {
            console.log("Game over condition met on turn advance.");
            setGameState("gameover");
            setCurrentSong(null);
        } else {
            setCurrentPlayerIndex(nextPlayerIndex);
            setCurrentSongIndex(nextSongIndex);
        }
    }, [
        currentPlayerIndex,
        currentSongIndex,
        players,
        currentPlaylistDeck.length,
    ]);


    const handleGuessSubmit = useCallback(
        async (guessData) => {
            setIsLoading(true);

            const {
                guessTitle,
                guessArtist,
                selectedRangeValue,
                playCount,
            } = guessData;

            if (!currentSong) {
                setIsLoading(false);
                return null;
            }

            const correctTitleLower = currentSong.title.toLowerCase();
            const correctArtistLower = currentSong.artist.toLowerCase();
            const correctYear = currentSong.year;
            const formatString = (str) =>
                str
                    .toLowerCase()
                    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()']/g, "")
                    .replace(/\s+/g, " ")
                    .trim();
            const isTitleCorrect =
                formatString(guessTitle) === formatString(correctTitleLower);
            const isArtistCorrect =
                formatString(guessArtist) ===
                formatString(correctArtistLower);
            const { start: rangeStart, end: rangeEnd } =
                parseRange(selectedRangeValue);
            const isYearCorrectlyPlaced =
                correctYear >= rangeStart && correctYear <= rangeEnd;
            let turnScore = 0;
            let feedbackText = `The song was: ${currentSong.title} by ${currentSong.artist} (${currentSong.year}). `;
            let feedbackType = "incorrect";
            let correctPlacement = false;
            const wasReplayed = playCount > 1;

            if (isTitleCorrect && isArtistCorrect && isYearCorrectlyPlaced) {
                feedbackText += "Perfect guess & placement!";
                feedbackType = "correct";
                turnScore = 3;
                correctPlacement = true;
                if (wasReplayed) {
                    turnScore = Math.max(0, turnScore - REPLAY_PENALTY);
                    feedbackText += ` (-${REPLAY_PENALTY}pt for replay)`;
                }
            } else if (
                isTitleCorrect &&
                isArtistCorrect &&
                !isYearCorrectlyPlaced
            ) {
                feedbackText += `Correct song, wrong placement. Year ${correctYear} not in '${selectedRangeValue}'.`;
                turnScore = 1;
            } else if (
                !isTitleCorrect &&
                !isArtistCorrect &&
                isYearCorrectlyPlaced
            ) {
                feedbackText += `Incorrect song, but correct placement range!`;
                turnScore = 1;
                correctPlacement = true;
            } else {
                feedbackText += "Incorrect song & placement.";
                turnScore = 0;
            }
            turnScore = Math.max(0, turnScore);

            let playerTimelineFull = false;
            setPlayers((prevPlayers) => {
                const newPlayers = [...prevPlayers];
                const playerToUpdate = { ...newPlayers[currentPlayerIndex] };
                playerToUpdate.score += turnScore;
                if (correctPlacement) {
                    if (playerToUpdate.timeline.length < MAX_TIMELINE_LENGTH) {
                        playerToUpdate.timeline = [
                            ...playerToUpdate.timeline,
                            currentSong,
                        ].sort((a, b) => a.year - b.year);
                    } else {
                        playerTimelineFull = true;
                    }
                }
                newPlayers[currentPlayerIndex] = playerToUpdate;
                return newPlayers;
            });
            if (playerTimelineFull && correctPlacement)
                feedbackText += " (Timeline full, card not added)";

            return { message: feedbackText, type: feedbackType };
        },
        [currentSong, currentPlayerIndex, players, currentPlaylistDeck], // Removed length dependency as deck doesn't change mid-game
    );

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
                            currentSong={currentSong}
                            placementOptions={placementOptions}
                            onSubmitGuess={handleGuessSubmit}
                            isLoading={isLoading}
                            onAdvanceTurn={handleAdvanceTurn}
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
                return <p>Unexpected error. Try logging out.</p>;
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
        </div>
    );
}

export default GameContainer;
