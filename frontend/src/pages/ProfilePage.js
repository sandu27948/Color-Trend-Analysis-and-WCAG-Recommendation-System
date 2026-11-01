import React, { useEffect, useState } from "react";
import { getProfile, updateProfile, getApiError } from "../services/authApi";

function ProfilePage({ user, onProfileUpdated }) {
  const [profile, setProfile] = useState(user);
  const [name, setName] = useState(user?.name || "");
  const [loading, setLoading] = useState(!user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user) {
      setProfile(user);
      setName(user.name || "");
      setLoading(false);
      return;
    }

    let mounted = true;
    getProfile()
      .then((result) => {
        if (!mounted) return;
        setProfile(result.user || null);
        setName(result.user?.name || "");
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getApiError(err, "Unable to load profile."));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const result = await updateProfile({ name });
      setProfile(result.user || null);
      setMessage(result.message || "Profile updated.");
      if (result.user) {
        onProfileUpdated(result.user);
      }
    } catch (err) {
      setError(getApiError(err, "Unable to update profile."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="message">Loading profile...</div>;
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <span className="eyebrow">Profile</span>
          <h1>Account details</h1>
          <p>Manage your account identity used for login and personalized dashboard access.</p>
        </div>
      </div>

      <div className="profile-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field-input"
              minLength={2}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={profile?.email || ""}
              className="field-input"
              disabled
            />
          </label>

          <div className="profile-meta">
            <span><strong>User ID:</strong> {profile?.id || "-"}</span>
            <span><strong>Created:</strong> {profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : "-"}</span>
            <span><strong>Updated:</strong> {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "-"}</span>
          </div>

          {error && <div className="message error">{error}</div>}
          {message && <div className="message">{message}</div>}

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Update Profile"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default ProfilePage;
