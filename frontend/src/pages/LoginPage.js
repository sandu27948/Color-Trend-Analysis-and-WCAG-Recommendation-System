import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, getApiError } from "../services/authApi";

function LoginPage({ onSuccess }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
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
      const result = await login(form);
      onSuccess(result.user || null);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiError(err, "Unable to sign in."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-layout">
      <div className="auth-card">
        <div className="auth-head">
          <span className="eyebrow">Welcome back</span>
          <h1>Sign in to Color Trend Analysis and WCAG Recommendation System</h1>
          <p>Access your research workspace, analytics dashboards, and accessibility recommendation tools.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
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
              placeholder="Enter your password"
              required
            />
          </label>

          {error && <div className="message error">{error}</div>}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-footnote">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </section>
  );
}

export default LoginPage;
