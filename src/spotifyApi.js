import axios from "axios";

const BASE_URL = "https://api.spotify.com/v1";

const apiClient = axios.create({
    baseURL: BASE_URL,
});

export const setAuthToken = (token) => {
    if (token) {
        apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        console.log("Axios Authorization header set");
    } else {
        delete apiClient.defaults.headers.common["Authorization"];
        console.log("Axios Authorization header removed");
    }
};

export const getUserProfile = async () => {
    try {
        const response = await apiClient.get("/me");
        return response.data;
    } catch (error) {
        console.error(
            "Error fetching user profile:",
            error.response || error.message,
        );
        throw error;
    }
};

export const searchItems = async (query, types, limit = 20, offset = 0) => {
    if (!query || !types || types.length === 0) {
        throw new Error("Search query and types are required.");
    }
    try {
        const params = {
            q: query,
            type: types.join(","),
            limit,
            offset,
        };
        const response = await apiClient.get("/search", { params });
        return response.data;
    } catch (error) {
        console.error(
            "Error searching items:",
            error.response || error.message,
        );
        throw error;
    }
};

export const getUserPlaylists = async (limit = 20, offset = 0) => {
    try {
        const params = { limit, offset };
        const response = await apiClient.get("/me/playlists", { params });
        return response.data;
    } catch (error) {
        console.error(
            "Error fetching user playlists:",
            error.response || error.message,
        );
        throw error;
    }
};

export const getPlaylistDetails = async (playlistId) => {
    if (!playlistId) throw new Error("Playlist ID is required.");
    try {
        const response = await apiClient.get(`/playlists/${playlistId}`);
        return response.data;
    } catch (error) {
        console.error(
            `Error fetching details for playlist ${playlistId}:`,
            error.response || error.message,
        );
        throw error;
    }
};

export const getPlaylistItems = async (playlistId, limit = 50, offset = 0) => {
    if (!playlistId) throw new Error("Playlist ID is required.");
    try {
        const params = { limit, offset };
        const response = await apiClient.get(
            `/playlists/${playlistId}/tracks`,
            { params },
        );
        return response.data;
    } catch (error) {
        console.error(
            `Error fetching items for playlist ${playlistId}:`,
            error.response || error.message,
        );
        throw error;
    }
};

export const startPlayback = async (options = {}) => {
    try {
        const { device_id, ...body } = options;
        const params = device_id ? { device_id } : {};
        await apiClient.put(
            "/me/player/play",
            Object.keys(body).length > 0 ? body : null,
            { params },
        );
        console.log("Playback started/resumed", options);
    } catch (error) {
        console.error(
            "Error starting playback:",
            error.response?.data || error.message,
        );
        throw error;
    }
};

export const pausePlayback = async (device_id) => {
    try {
        const params = device_id ? { device_id } : {};
        await apiClient.put("/me/player/pause", null, { params }); // Body not needed for pause
        console.log("Playback paused");
    } catch (error) {
        console.error(
            "Error pausing playback:",
            error.response?.data || error.message,
        );
        throw error;
    }
};

export const nextTrack = async (device_id) => {
    try {
        const params = device_id ? { device_id } : {};
        await apiClient.post("/me/player/next", null, { params }); // Body not needed
        console.log("Skipped to next track");
    } catch (error) {
        console.error(
            "Error skipping track:",
            error.response?.data || error.message,
        );
        throw error;
    }
};

export const previousTrack = async (device_id) => {
    try {
        const params = device_id ? { device_id } : {};
        await apiClient.post("/me/player/previous", null, { params });
        console.log("Skipped to previous track");
    } catch (error) {
        console.error(
            "Error skipping to previous track:",
            error.response?.data || error.message,
        );
        throw error;
    }
};
