export const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

export const parseRange = (rangeValue) => {
    const parts = rangeValue.split('-');
    const type = parts[0];

    if (type === 'before') {
        return { start: -Infinity, end: parseInt(parts[1]) - 1 };
    } else if (type === 'after') {
        return { start: parseInt(parts[1]) + 1, end: Infinity };
    } else if (type === 'between') {
        return { start: parseInt(parts[1]), end: parseInt(parts[2]) };
    } else {
        console.error("Invalid range value:", rangeValue);
        return { start: NaN, end: NaN };
    }
};

export const generateOptions = (timeline) => {
    const options = [];
    if (!timeline || timeline.length === 0) {
        options.push({ value: "before-Infinity", text: "Place first card" });
         options.push({ value: "before-3000", text: "Place first card (Before any year)" });
         options.push({ value: "after-0", text: "Place first card (After any year)" });

    } else {
        options.push({
            value: `before-${timeline[0].year}`,
            text: `Before ${timeline[0].year}`
        });

        for (let i = 0; i < timeline.length - 1; i++) {
             if (timeline[i].year !== timeline[i+1].year) {
                 options.push({
                    value: `between-${timeline[i].year}-${timeline[i+1].year}`,
                    text: `Between ${timeline[i].year} and ${timeline[i+1].year}`
                });
             } else {
                 // If years are same, offer placement before/after the block of same years
                 // This logic gets complex. Simplification: Treat adjacent same years as one point.
                 // Let's ignore the "between" option for adjacent same years for now.
             }
        }

        options.push({
            value: `after-${timeline[timeline.length - 1].year}`,
            text: `After ${timeline[timeline.length - 1].year}`
        });
    }

    return options;
};