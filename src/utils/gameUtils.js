export const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

export const parseRange = (rangeValue) => {
    const parts = rangeValue.split("-");
    const type = parts[0];

    if (type === "before") {
        return { start: -Infinity, end: parseInt(parts[1]) - 1 };
    } else if (type === "after") {
        return { start: parseInt(parts[1]) + 1, end: Infinity };
    } else if (type === "between") {
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
        options.push({
            value: "before-3000",
            text: "Place first card (Before any year)",
        });
        options.push({
            value: "after-0",
            text: "Place first card (After any year)",
        });
    } else {
        options.push({
            value: `before-${timeline[0].year}`,
            text: `Before ${timeline[0].year}`,
        });

        for (let i = 0; i < timeline.length - 1; i++) {
            if (timeline[i].year !== timeline[i + 1].year) {
                options.push({
                    value: `between-${timeline[i].year}-${
                        timeline[i + 1].year
                    }`,
                    text: `Between ${timeline[i].year} and ${
                        timeline[i + 1].year
                    }`,
                });
            }
        }

        options.push({
            value: `after-${timeline[timeline.length - 1].year}`,
            text: `After ${timeline[timeline.length - 1].year}`,
        });
    }

    return options;
};

export const normalizeString = (str) => {
    if (!str) {
        return "";
    }
    let normalized = str.toLowerCase();
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const versionIndicatorsRegex =
       /\s*((?:\(|\[).*?\b(remix|edit|live|feat|ft|version|acoustic|instrumental|explicit|clean|demo|radio)\b.*?(?:\]|\)))\s*$/i;
    normalized = normalized.replace(versionIndicatorsRegex, "");
    normalized = normalized.replace(/\s*&\s*/g, " and ");
    normalized = normalized.replace(/[^\w\s]|_/g, "");
    normalized = normalized.replace(/\s+/g, " ").trim();
    return normalized;
};

export const compareForgiving = (guess, actual) => {
    const normalizedGuess = normalizeString(guess);
    const normalizedActual = normalizeString(actual);
    if (!normalizedGuess || !normalizedActual) {
        return normalizedGuess === normalizedActual;
    }
    return normalizedGuess === normalizedActual;
};

export const levenshteinDistance = (s1, s2) => {
    const len1 = s1.length;
    const len2 = s2.length;
    const d = [];

    for (let i = 0; i <= len1; i++) {
        d[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        d[0][j] = j;
    }

    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost,
            );
        }
    }

    return d[len1][len2];
};

export const compareWithTolerance = (guess, actual, tolerance = 2) => {
    const normalizedGuess = normalizeString(guess);
    const normalizedActual = normalizeString(actual);

    if (!normalizedGuess || !normalizedActual) {
        return normalizedGuess === normalizedActual;
    }
    if (normalizedGuess === normalizedActual) {
        return true;
    }

    const distance = levenshteinDistance(normalizedGuess, normalizedActual);
    return distance <= tolerance;
};
