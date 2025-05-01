import React, { useMemo } from "react";
import { parseRange, compareWithTolerance } from "../../utils/gameUtils";

const REPLAY_PENALTY = 1;

function FeedbackDialog({
    isOpen,
    currentSong,
    guessData,
    timelineStatus,
    onClose,
}) {
    const feedbackDetails = useMemo(() => {
        if (!isOpen || !currentSong || !guessData) {
            return null;
        }

        const { guessTitle, guessArtist, selectedRangeValue, playCount } =
            guessData;

        const correctYear = currentSong.year;
        const { start: rangeStart, end: rangeEnd } = parseRange(
            selectedRangeValue || "",
        );

        const isPlacementCorrect =
            correctYear >= rangeStart && correctYear <= rangeEnd;

        const isTitleCorrect = compareWithTolerance(
            guessTitle,
            currentSong.title,
        );
        const isArtistCorrect = compareWithTolerance(
            guessArtist,
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

        const wasReplayed = playCount > 1;

        const overallType =
            (isTitleCorrect && isArtistCorrect) || isPlacementCorrect
                ? "correct"
                : "incorrect";
        const penaltyApplied = wasReplayed
            ? parseInt(playCount, 10) * REPLAY_PENALTY
            : 0;

        return {
            type: overallType,
            songDetails: {
                title: currentSong.title,
                artist: currentSong.artist,
                year: currentSong.year,
            },
            accuracy: {
                title: isTitleCorrect,
                artist: isArtistCorrect,
                placement: isPlacementCorrect,
            },
            timeline: timelineStatus || { cardAdded: false, wasFull: false },
            turnScore: turnScore,
            penalty: penaltyApplied,
        };
    }, [isOpen, currentSong, guessData, timelineStatus]);

    if (!isOpen || !feedbackDetails) {
        return null;
    }

    const isDialogCorrect = feedbackDetails.type === "correct";

    return (
        <div className="dialog-overlay" onClick={onClose}>
            <div
                className={`dialog-box feedback-dialog ${
                    isDialogCorrect
                        ? "feedback-border-correct"
                        : "feedback-border-incorrect"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <h3
                    className={`feedback-header ${
                        isDialogCorrect
                            ? "feedback-header-correct"
                            : "feedback-header-incorrect"
                    }`}
                >
                    {isDialogCorrect ? "Correct" : "Wrong"}
                </h3>

                <div className="feedback-content-structured">
                    <div className="feedback-text-block">
                        <p className="feedback-song-intro">The song was:</p>
                        <p className="feedback-song-details">
                            <strong>{feedbackDetails.songDetails.title}</strong>{" "}
                            by{" "}
                            <strong>
                                {feedbackDetails.songDetails.artist}
                            </strong>{" "}
                            ({feedbackDetails.songDetails.year})
                        </p>
                    </div>
                </div>

                <hr />

                <table className="feedback-accuracy-table">
                    <tbody>
                        <tr>
                            <td className="feedback-accuracy-cell">
                                Title:{" "}
                                {feedbackDetails.accuracy.title ? "✅" : "❌"}
                            </td>
                            <td>{guessData.guessTitle}</td>
                        </tr>
                        <tr>
                            <td className="feedback-accuracy-cell">
                                Artist:{" "}
                                {feedbackDetails.accuracy.artist ? "✅" : "❌"}
                            </td>
                            <td>{guessData.guessArtist}</td>
                        </tr>
                        <tr>
                            <td className="feedback-accuracy-cell">
                                Place:{" "}
                                {feedbackDetails.accuracy.placement
                                    ? "✅"
                                    : "❌"}
                            </td>
                            <td>{guessData.selectedRangeValue}</td>
                        </tr>
                    </tbody>
                </table>

                <hr />
                <p className="feedback-guess-summary">
                    <span className="feedback-points">
                        Points awarded: {feedbackDetails.turnScore}
                    </span>

                    {feedbackDetails.penalty > 0 && (
                        <span className="feedback-penalty">
                            {` (-${feedbackDetails.penalty}pt for replay)`}
                        </span>
                    )}
                </p>

                <hr />
                {feedbackDetails.accuracy.placement && (
                    <p className="feedback-timeline-update timeline-added">
                        Song added to your timeline!
                    </p>
                )}
            </div>
        </div>
    );
}

export default FeedbackDialog;
