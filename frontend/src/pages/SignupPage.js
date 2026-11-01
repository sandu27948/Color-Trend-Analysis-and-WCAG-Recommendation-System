import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signup, getApiError } from "../services/authApi";

function SignupPage({ onSuccess }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signup(form);
      onSuccess(result.user || null);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiError(err, "Unable to create account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-layout">
      <div className="auth-card">
        <div className="auth-head">
          <span className="eyebrow">Create account</span>
          <h1>Set up your profile</h1>
          <p>Register once and keep your color trend and accessibility workflow in one secured dashboard.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="field-input"
              placeholder="Your name"
              minLength={2}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="field-input"
              placeholder="researcher@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="field-input"
              placeholder="Minimum 6 characters"
              minLength={6}
              required
            />
          </label>

          {error && <div className="message error">{error}</div>}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="auth-footnote">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}

export default SignupPage;
