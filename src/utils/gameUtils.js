/** Shuffles array in place. */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/** Parses a year range string (e.g., "1990-1995") into start/end years */
export function parseRange(rangeString) {
    if (!rangeString || !rangeString.includes("-")) {
        return { start: -Infinity, end: Infinity };
    }
    const parts = rangeString.split("-").map(Number);
    return { start: parts[0], end: parts[1] };
}

/** Generates placement options based on the current timeline */
export function generateOptions(timeline = []) {
    const sortedTimeline = [...timeline].sort((a, b) => a.year - b.year);
    const options = [];

    if (sortedTimeline.length > 0) {
        options.push({
            value: `-Infinity-${sortedTimeline[0].year - 1}`,
            text: `Before ${sortedTimeline[0].year} (${sortedTimeline[0].title})`,
        });
    } else {
        options.push({
            value: `-Infinity-Infinity`,
            text: `Anytime (First Card)`,
        });
        return options;
    }

    for (let i = 0; i < sortedTimeline.length - 1; i++) {
        options.push({
            value: `${sortedTimeline[i].year + 1}-${
                sortedTimeline[i + 1].year - 1
            }`,
            text: `Between ${sortedTimeline[i].year} (${
                sortedTimeline[i].title
            }) and ${sortedTimeline[i + 1].year} (${
                sortedTimeline[i + 1].title
            })`,
        });
    }

    options.push({
        value: `${sortedTimeline[sortedTimeline.length - 1].year + 1}-Infinity`,
        text: `After ${sortedTimeline[sortedTimeline.length - 1].year} (${
            sortedTimeline[sortedTimeline.length - 1].title
        })`,
    });

    return options;
}
