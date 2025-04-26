import React from 'react';

function UserProfile({ profile }) {
    if (!profile) return null;

    return (
        <div className="profile">
            <h2>Welcome, {profile.display_name}!</h2>
            {profile.images?.[0]?.url && (
                <img
                    src={profile.images[0].url}
                    alt="Profile"
                    width="100"
                    className="profile-pic"
                />
            )}
            <p><small>ID: {profile.id} | Email: {profile.email}</small></p>
        </div>
    );
}

export default UserProfile;