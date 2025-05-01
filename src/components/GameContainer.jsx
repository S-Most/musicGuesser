import React, { useState, useEffect, useCallback } from "react";
import SetupScreen from "./game/SetupScreen";
import GameScreen from "./game/GameScreen";
import TimelinesDisplay from "./game/TimelinesDisplay";
import GameOverScreen from "./game/GameOverScreen";
import { getUserPlaylists, getPlaylistItems } from "../spotifyApi";

import {
    shuffleArray,
    parseRange,
    generateOptions,
    compareWithTolerance,
} from "../utils/gameUtils";

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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const [feedbackTriggerData, setFeedbackTriggerData] = useState(null);

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
                // albumArt: t.album.images?.[0]?.url,
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
        setFeedbackTriggerData(null);
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

    useEffect(() => {
        if (gameState === "playing" && currentPlaylistDeck.length > 0) {
            const song = currentPlaylistDeck[currentSongIndex];
            const player = players[currentPlayerIndex];
            if (song && player) {
                setCurrentSong(song);
                setPlacementOptions(generateOptions(player.timeline));
            } else {
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

    const handleAdvanceTurn = useCallback(() => {
        setIsLoading(false);
        setFeedbackTriggerData(null);

        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        const nextSongIndex = currentSongIndex + 1;

        const isGameOver =
            nextSongIndex >= currentPlaylistDeck.length ||
            players.some((p) => p.timeline.length >= MAX_TIMELINE_LENGTH);

        if (isGameOver) {
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
        (guessData) => {
            if (!currentSong) return;

            setIsLoading(true);

            const correctYear = currentSong.year;
            const { start: rangeStart, end: rangeEnd } = parseRange(
                guessData.selectedRangeValue || "",
            );

            const isPlacementCorrect =
                correctYear >= rangeStart && correctYear <= rangeEnd;

            const isTitleCorrect = compareWithTolerance(
                guessData.guessTitle,
                currentSong.title,
            );
            const isArtistCorrect = compareWithTolerance(
                guessData.guessArtist,
                currentSong.artist,
            );

            const isPerfectGuess =
                isTitleCorrect && isArtistCorrect && isPlacementCorrect;

            let turnScore = 0;
            if (isPlacementCorrect) turnScore += 1;
            if (isTitleCorrect) turnScore += 1;
            if (isArtistCorrect) turnScore += 1;
            turnScore -= Math.max((guessData.playCount - 1), 0) * REPLAY_PENALTY;
            if (turnScore < 0) turnScore = 0;
            if (isPerfectGuess) turnScore = 5;

            let cardAdded = false;
            let wasFull = false;
            setPlayers((prevPlayers) => {
                const newPlayers = [...prevPlayers];
                const playerToUpdate = { ...newPlayers[currentPlayerIndex] };
                playerToUpdate.score += turnScore;

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

            setFeedbackTriggerData({
                currentSong: currentSong,
                guessData: guessData,
                timelineStatus: { cardAdded, wasFull },
                turnScore: turnScore,
            });
        },
        [currentSong, currentPlayerIndex],
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
                            currentSong={currentSong}
                            placementOptions={placementOptions}
                            onSubmitGuess={handleGuessSubmit}
                            isLoading={isLoading}
                            onAdvanceTurn={handleAdvanceTurn}
                            feedbackTriggerData={feedbackTriggerData}
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
        </div>
    );
}

export default GameContainer;
