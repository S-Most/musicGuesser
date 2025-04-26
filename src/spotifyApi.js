import axios from 'axios';

const API_BASE_URL = 'https://api.spotify.com/v1';
let authToken = null;

export const setAuthToken = (token) => {
    authToken = token;
};

const getHeaders = () => {
    if (!authToken) {
        throw new Error('Authentication token not set.');
    }
    return {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
    };
};

const makeRequest = async (method, endpoint, params = {}, data = null) => {
    try {
        const response = await axios({
            method: method,
            url: `${API_BASE_URL}${endpoint}`,
            headers: getHeaders(),
            params: params,
            data: data,
        });
        return response.data;
    } catch (error) {
        console.error(`Spotify API Error (${method} ${endpoint}):`, error.response?.data || error.message);
        throw error;
    }
};


// --- Existing Auth Functions ---

export const getAccessTokenFromCode = async (clientId, redirectUri, code, codeVerifier) => {
     const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
    const params = new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
    });

    try {
        const response = await axios.post(TOKEN_ENDPOINT, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error getting access token:', error.response?.data || error.message);
        throw error;
    }
};


export const refreshAccessToken = async (clientId, refreshToken) => {
     const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
     const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
    });

     try {
        const response = await axios.post(TOKEN_ENDPOINT, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error refreshing access token:', error.response?.data || error.message);
        throw error;
    }
};

export const getUserProfile = async () => {
    return makeRequest('get', '/me');
};

export const getUserPlaylists = async (limit = 20, offset = 0) => {
     return makeRequest('get', '/me/playlists', { limit, offset });
};

export const getPlaylistItems = async (playlistId, limit = 50, offset = 0) => {
    const fields = 'items(track(id,name,artists(name),album(release_date,images),preview_url,uri)),limit,next,offset,previous,total';
    return makeRequest('get', `/playlists/${playlistId}/tracks`, { limit, offset, fields });
};


export const searchItems = async (query, types = ['track'], limit = 20) => {
    return makeRequest('get', '/search', { q: query, type: types.join(','), limit });
};

export const startPlayback = async (options = {}) => {
    return makeRequest('put', '/me/player/play', {}, options);
};

export const pausePlayback = async () => {
    return makeRequest('put', '/me/player/pause');
};