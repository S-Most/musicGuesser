/* eslint-disable no-useless-escape */
import React, { useMemo } from "react";
import { parseRange } from "../../utils/gameUtils";

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
            formatString(guessArtist) === formatString(correctArtistLower);
        const { start: rangeStart, end: rangeEnd } = parseRange(
            selectedRangeValue || "",
        );
        const isPlacementCorrect =
            correctYear >= rangeStart && correctYear <= rangeEnd;
        const wasReplayed = playCount > 1;

        const isPerfectGuess =
            isTitleCorrect && isArtistCorrect && isPlacementCorrect;
        const overallType =
            (isTitleCorrect && isArtistCorrect) || isPlacementCorrect
                ? "correct"
                : "incorrect";
        const penaltyApplied =
            isPerfectGuess && wasReplayed ? REPLAY_PENALTY : 0;

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

                        <p className="feedback-guess-summary">
                            {feedbackDetails.penalty > 0 && (
                                <span className="feedback-penalty">
                                    {" "}
                                    (-{feedbackDetails.penalty}pt for replay on
                                    perfect guess)
                                </span>
                            )}
                        </p>
                        {feedbackDetails.timeline.cardAdded && (
                            <p className="feedback-timeline-update timeline-added">
                                Song added to your timeline!
                            </p>
                        )}
                    </div>
                </div>

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

                <form
                    method="dialog"
                    className="dialog-actions"
                    onSubmit={(e) => {
                        e.preventDefault();
                        onClose();
                    }}
                >
                    <button
                        className="dialog-confirm-button"
                        value="confirm"
                        type="submit"
                    >
                        Continue
                    </button>
                </form>
            </div>
        </div>
    );
}

export default FeedbackDialog;
