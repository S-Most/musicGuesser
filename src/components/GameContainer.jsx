/* eslint-disable no-unused-vars */
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

function GameContainer({ onLogout, userProfile }) {
    const [gameState, setGameState] = useState("setup");
    const [players, setPlayers] = useState([]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [currentSongIndex, setCurrentSongIndex] = useState(0);
    const [userPlaylists, setUserPlaylists] = useState({ items: [], total: 0 });
    const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
    const [currentPlaylistDeck, setCurrentPlaylistDeck] = useState([]);
    const [currentSong, setCurrentSong] = useState(null);
    const [placementOptions, setPlacementOptions] = useState([]);
    const [feedback, setFeedback] = useState({ message: "", type: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPlaylists = async () => {
            setIsLoading(true);
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
            } finally {
                setIsLoading(false);
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
        console.log(`processTracks: Received ${items?.length ?? 0} items.`);

        if (!items || items.length === 0) {
            return [];
        }

        const tracksOnly = items.map((item) => item.track);

        const filteredForData = tracksOnly.filter((track, index) => {
            const hasTrack = !!track;
            const hasReleaseDate = !!track?.album?.release_date;
            const hasUri = !!track?.uri;
            return hasTrack && hasReleaseDate && hasUri;
        });

        const mappedToGameFormat = filteredForData.map((track) => {
            const yearString = track.album.release_date.substring(0, 4);
            const year = parseInt(yearString);
            if (isNaN(year)) {
                console.log(
                    `processTracks: Failed to parse year for track ${track.id}. Release date: ${track.album.release_date}`,
                );
            }
            return {
                id: track.id,
                title: track.name,
                artist: track.artists[0]?.name || "Unknown Artist",
                year: year,
                albumArt: track.album.images?.[0]?.url,
                uri: track.uri,
            };
        });

        const finalTracks = mappedToGameFormat.filter(
            (track) => !isNaN(track.year),
        );
        if (
            mappedToGameFormat.length > 0 &&
            finalTracks.length === 0 &&
            filteredForData.length > 0
        ) {
            console.warn(
                "processTracks: All valid tracks were filtered out due to invalid year parsing.",
            );
        }

        return finalTracks;
    };

    // --- Game Start ---
    const handleStartGame = useCallback(async () => {
        if (players.length === 0) {
            setError("Add at least one player to start.");
            setTimeout(() => setError(null), 3000);
            return;
        }
        if (!selectedPlaylistId) {
            setError("Please select a playlist.");
            setTimeout(() => setError(null), 3000);
            return;
        }

        setIsLoading(true);
        setError(null);
        setFeedback({ message: "", type: "" });

        try {
            console.log(
                `Starting game with playlist ID: ${selectedPlaylistId}`,
            );
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
                    throw new Error(
                        "Failed to fetch playlist items or playlist is empty.",
                    );
                }
                console.log(
                    `Fetched ${playlistData.items.length} tracks from offset ${offset} (total fetched: ${totalFetched})`,
                );
                const processed = processTracks(playlistData.items);
                console.log(`Processed ${processed.length} tracks.`);
                allTracks = allTracks.concat(processed);
                playlistTotal = playlistData.total;
                offset += limit;
                totalFetched += playlistData.items.length;
            } while (totalFetched < playlistTotal && allTracks.length < 200);

            console.log(
                `Fetched ${allTracks.length} processable tracks from playlist.`,
            );

            if (allTracks.length < players.length + 1) {
                throw new Error(
                    `Not enough playable tracks (${allTracks.length}) with previews and release years in the selected playlist to start the game.`,
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
            setError(
                `Failed to start game: ${err.message}. Try a different playlist or check console.`,
            );
            setGameState("setup");
            if (err.response?.status === 401) onLogout();
        } finally {
            setIsLoading(false);
        }
    }, [players, selectedPlaylistId, onLogout]);

    useEffect(() => {
        if (gameState === "playing" && currentPlaylistDeck.length > 0) {
            const gameOver =
                currentSongIndex >= currentPlaylistDeck.length ||
                players.some((p) => p.timeline.length >= MAX_TIMELINE_LENGTH);

            if (gameOver) {
                console.log("Game over condition met.");
                setGameState("gameover");
                setCurrentSong(null);
                return;
            }

            const song = currentPlaylistDeck[currentSongIndex];
            const currentPlayer = players[currentPlayerIndex];

            if (song && currentPlayer) {
                setCurrentSong(song);
                setPlacementOptions(generateOptions(currentPlayer.timeline));
                setFeedback({ message: "", type: "" });
            } else {
                console.error(
                    "Error setting current song or player. Deck:",
                    currentPlaylistDeck.length,
                    "Song Index:",
                    currentSongIndex,
                    "Player Index:",
                    currentPlayerIndex,
                );
                setError(
                    "An error occurred during gameplay. Please try again.",
                );
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

    // --- Guess Handling ---
    const handleGuessSubmit = useCallback(
        (guessData) => {
            const {
                guessedTitle,
                guessedArtist,
                selectedRangeValue,
                playCount,
            } = guessData;

            if (!currentSong) return;

            setIsLoading(true);

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
                formatString(guessedTitle) === formatString(correctTitleLower);
            const isArtistCorrect =
                formatString(guessedArtist) ===
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

            // --- Apply Penalty Logic ---
            if (isTitleCorrect && isArtistCorrect && isYearCorrectlyPlaced) {
                feedbackText += "Perfect guess and placement!";
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
                feedbackText += `Correct song, but wrong placement. Year ${correctYear} doesn't fit in '${selectedRangeValue}'.`;
                turnScore = 1;
            } else if (
                !isTitleCorrect &&
                !isArtistCorrect &&
                isYearCorrectlyPlaced
            ) {
                feedbackText += `Incorrect song, but correct placement!`;
                turnScore = 1;
                correctPlacement = true;
            } else {
                feedbackText += "Incorrect song and placement.";
                turnScore = 0;
            }

            turnScore = Math.max(0, turnScore);

            setPlayers((prevPlayers) => {
                const newPlayers = [...prevPlayers];
                const playerToUpdate = { ...newPlayers[currentPlayerIndex] };
                playerToUpdate.score += turnScore;
                if (correctPlacement) {
                    playerToUpdate.timeline = [
                        ...playerToUpdate.timeline,
                        currentSong,
                    ].sort((a, b) => a.year - b.year);
                }
                newPlayers[currentPlayerIndex] = playerToUpdate;
                return newPlayers;
            });

            setFeedback({ message: feedbackText, type: feedbackType });

            setTimeout(
                () => {
                    setIsLoading(false);
                    const nextPlayerIndex =
                        (currentPlayerIndex + 1) % players.length;
                    let nextSongIndex = currentSongIndex;
                    nextSongIndex = currentSongIndex + 1;
                    setCurrentPlayerIndex(nextPlayerIndex);
                    setCurrentSongIndex(nextSongIndex);
                },
                feedbackType === "correct" ? 3500 : 5000,
            );
        },
        [currentSong, currentPlayerIndex, players, currentSongIndex],
    );

    // --- Reset Game ---
    const handlePlayAgain = useCallback(() => {
        setPlayers([]);
        setCurrentPlaylistDeck([]);
        setCurrentSong(null);
        setCurrentPlayerIndex(0);
        setCurrentSongIndex(0);
        setSelectedPlaylistId("");
        setFeedback({ message: "", type: "" });
        setError(null);
        setGameState("setup");
    }, []);

    // --- Render Logic ---
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
                    return <p className="loading">Loading next turn...</p>;
                }
                return (
                    <>
                        <GameScreen
                            currentPlayer={players[currentPlayerIndex]}
                            currentSong={currentSong}
                            placementOptions={placementOptions}
                            onSubmitGuess={handleGuessSubmit}
                            feedback={feedback}
                            isLoading={isLoading}
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
                return (
                    <p>
                        An unexpected error occurred. Please try logging out and
                        back in.
                    </p>
                );
        }
    };

    return (
        <div className="game-container">
            <button
                onClick={onLogout}
                style={{ position: "fixed", top: "10px", right: "10px" }}
                disabled={isLoading}
            >
                Logout
            </button>
            <h1>Music Timeline Game</h1>
            {renderGameState()}
        </div>
    );
}

export default GameContainer;
