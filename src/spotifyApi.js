import axios from "axios";

// --- Constants ---
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`;
const API_BASE_URL = "https://api.spotify.com/v1";

// --- Module State ---
let spotifyToken = null; // Holds the current access token

// --- Core Functions ---

/**
 * Stores the Access Token for use in subsequent API calls.
 * @param {string | null} token - The Spotify Access Token or null to clear it.
 */
export const setAuthToken = (token) => {
    spotifyToken = token;
    // console.log("Auth token set in API module:", spotifyToken ? "Token Present" : "Token Cleared");
};

/**
 * Exchanges an Authorization Code (obtained via PKCE redirect) for an Access Token.
 * @param {string} clientId - Your Spotify Client ID.
 * @param {string} redirectUri - The redirect URI used in the initial authorization request.
 * @param {string} code - The authorization code received from Spotify.
 * @param {string} codeVerifier - The original code verifier string used to generate the code challenge.
 * @returns {Promise<object>} A promise that resolves with the token data (access_token, refresh_token, expires_in, etc.).
 */
export const getAccessTokenFromCode = async (clientId, redirectUri, code, codeVerifier) => {
    if (!clientId || !redirectUri || !code || !codeVerifier) {
        throw new Error("Missing required parameters for token exchange.");
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("code_verifier", codeVerifier);

    try {
        console.log("Sending POST to TOKEN_ENDPOINT for initial token...");
        const result = await axios.post(TOKEN_ENDPOINT, params, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
        return result.data;
    } catch (error) {
        console.error("Error exchanging code for token:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        // Rethrow the error so App.js can handle UI feedback
        throw error;
    }
};

/**
 * Refreshes an expired Access Token using a Refresh Token.
 * @param {string} clientId - Your Spotify Client ID.
 * @param {string} refreshToken - The refresh token obtained during the initial authorization.
 * @returns {Promise<object>} A promise that resolves with the new token data (access_token, potentially a new refresh_token, expires_in).
 */
export const refreshAccessToken = async (clientId, refreshToken) => {
     if (!clientId || !refreshToken) {
        throw new Error("Missing required parameters for token refresh.");
     }

     const params = new URLSearchParams();
     params.append("client_id", clientId);
     params.append("grant_type", "refresh_token");
     params.append("refresh_token", refreshToken);

     try {
         console.log("Sending POST to TOKEN_ENDPOINT for token refresh...");
         const result = await axios.post(TOKEN_ENDPOINT, params, {
             headers: {
                 "Content-Type": "application/x-www-form-urlencoded",
             },
         });
         // NOTE: Spotify might NOT always return a new refresh_token here.
         // The calling code (App.js) should handle storing it if provided.
         return result.data;
     } catch (error) {
         console.error("Error refreshing access token:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
         // Rethrow the error so App.js can handle UI feedback (e.g., force logout)
         throw error;
     }
};

// --- API Client Helper ---

/**
 * Creates an Axios instance configured with the Spotify API base URL and Authorization header.
 * Throws an error if the token is not set.
 * @returns {axios.AxiosInstance} Configured Axios instance.
 */
const getApiClient = () => {
    if (!spotifyToken) {
        console.error("Spotify API call attempted without an access token!");
        // This error should ideally be caught by the calling function to handle state (e.g., logout)
        throw new Error("Authentication token is not set. Please log in.");
    }
    return axios.create({
        baseURL: API_BASE_URL,
        headers: {
            Authorization: `Bearer ${spotifyToken}`,
            "Content-Type": "application/json",
        },
    });
};


// --- Spotify API Endpoint Functions ---

/**
 * Fetches the current user's profile information.
 * @returns {Promise<object>} User profile data.
 */
export const getUserProfile = async () => {
    const apiClient = getApiClient(); // Get instance with current token
    const response = await apiClient.get("/me");
    return response.data;
};

/**
 * Fetches the current user's playlists.
 * @param {number} [limit=20] - Max number of playlists to return.
 * @param {number} [offset=0] - Index of the first playlist to return.
 * @returns {Promise<object>} Object containing playlist data.
 */
export const getUserPlaylists = async (limit = 20, offset = 0) => {
    const apiClient = getApiClient();
    const response = await apiClient.get("/me/playlists", {
        params: { limit, offset },
    });
    return response.data;
};

/**
 * Searches for items (tracks, artists, albums, playlists) on Spotify.
 * @param {string} query - The search query string.
 * @param {string[]} [types=['track']] - Array of item types to search for (e.g., ['track', 'artist']).
 * @param {number} [limit=20] - Max number of results per type.
 * @returns {Promise<object>} Search results object.
 */
export const searchItems = async (query, types = ["track"], limit = 20) => {
    if (!query) throw new Error("Search query cannot be empty.");
    const apiClient = getApiClient();
    const response = await apiClient.get("/search", {
        params: {
            q: query,
            type: types.join(","),
            limit: limit,
        },
    });
    return response.data;
};

/**
 * Starts or resumes playback on the user's active device.
 * Requires an active Spotify device. This might fail if Spotify isn't open or active.
 * @param {object} [options={}] - Playback options (e.g., { uris: [...] }, { context_uri: '...' }).
 * @param {string} [deviceId] - Optional device ID to target.
 * @returns {Promise<void>}
 */
export const startPlayback = async (options = {}, deviceId = undefined) => {
    const apiClient = getApiClient();
    const params = deviceId ? { device_id: deviceId } : {};
    // PUT request to /me/player/play with optional device_id query param and request body
    await apiClient.put("/me/player/play", options, { params });
};

/**
 * Pauses playback on the user's active device.
 * @param {string} [deviceId] - Optional device ID to target.
 * @returns {Promise<void>}
 */
export const pausePlayback = async (deviceId = undefined) => {
    const apiClient = getApiClient();
    const params = deviceId ? { device_id: deviceId } : {};
    // PUT request to /me/player/pause with optional device_id query param
    await apiClient.put("/me/player/pause", null, { params }); // Body should be null or empty for pause
};

// --- Add other desired Spotify API functions here, following the pattern: ---
// export const getSomeOtherData = async (params) => {
//     const apiClient = getApiClient();
//     const response = await apiClient.get("/some-endpoint", { params });
//     return response.data;
// };