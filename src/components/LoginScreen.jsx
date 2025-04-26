import React from 'react';

function LoginScreen({ onLogin, error, isLoading, clientId }) {
    return (
        <div className="login-screen">
            <h1>Music Timeline Game</h1>
            {!clientId && (
                <p className="error" style={{ fontWeight: 'bold' }}>
                    Warning: VITE_SPOTIFY_CLIENT_ID is not set! App cannot function.
                </p>
            )}
            {error && <p className="error">Error: {error}</p>}
            {isLoading && <p className="loading">Loading...</p>}

            <p>Login to play the game</p>
            <button onClick={onLogin} disabled={!clientId || isLoading}>
                Login to Spotify
            </button>
        </div>
    );
}

export default LoginScreen;