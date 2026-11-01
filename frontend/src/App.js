import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import DatasetPage from "./pages/DatasetPage";
import AnalysisPage from "./pages/AnalysisPage";
import RecommendationPage from "./pages/RecommendationPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProfilePage from "./pages/ProfilePage";
import { getAuthToken, getProfile, logout, clearSession } from "./services/authApi";

function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [authState, setAuthState] = React.useState({
    loading: true,
    isAuthenticated: false,
    user: null
  });

  const refreshProfile = React.useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setAuthState({ loading: false, isAuthenticated: false, user: null });
      return;
    }

    try {
      const result = await getProfile();
      setAuthState({ loading: false, isAuthenticated: true, user: result.user || null });
    } catch (error) {
      clearSession();
      setAuthState({ loading: false, isAuthenticated: false, user: null });
    }
  }, []);

  React.useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const onAuthSuccess = (user) => {
    setAuthState({ loading: false, isAuthenticated: true, user });
  };

  const onProfileUpdated = (user) => {
    setAuthState((previous) => ({ ...previous, user }));
  };

  const handleLogout = async () => {
    await logout();
    setAuthState({ loading: false, isAuthenticated: false, user: null });
  };

  const pages = [
    { key: "home", path: "/", label: "Home" },
    { key: "dataset", path: "/dataset", label: "Dataset" },
    { key: "analysis", path: "/analysis", label: "Analysis" },
    { key: "recommendation", path: "/recommendation", label: "Recommendation" }
  ];

  if (authState.loading) {
    return (
      <div className="app-shell">
        <div className="message">Checking account session...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-shell">
        <header className="app-header app-sidebar">
          <div className="brand-panel">
            <div className="brand-mark">CTS</div>
            <div>
              <h1>Color Trend Analysis and WCAG Recommendation System</h1>
              <p className="brand-subtitle">Clean, professional color insights for data-driven decisions.</p>
            </div>
          </div>

          <nav className="app-nav" aria-label="Main navigation">
            {authState.isAuthenticated ? (
              <>
                {pages.map((page) => (
                  <NavLink
                    key={page.key}
                    to={page.path}
                    className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                  >
                    {page.label}
                  </NavLink>
                ))}
                <NavLink
                  to="/profile"
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  Profile
                </NavLink>
                <button type="button" className="nav-link nav-logout" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  Sign In
                </NavLink>
                <NavLink
                  to="/signup"
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  Sign Up
                </NavLink>
              </>
            )}
          </nav>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/login" element={authState.isAuthenticated ? <Navigate to="/" replace /> : <LoginPage onSuccess={onAuthSuccess} />} />
            <Route path="/signup" element={authState.isAuthenticated ? <Navigate to="/" replace /> : <SignupPage onSuccess={onAuthSuccess} />} />
            <Route
              path="/"
              element={(
                <ProtectedRoute isAuthenticated={authState.isAuthenticated}>
                  <Home />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/dataset"
              element={(
                <ProtectedRoute isAuthenticated={authState.isAuthenticated}>
                  <DatasetPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/analysis"
              element={(
                <ProtectedRoute isAuthenticated={authState.isAuthenticated}>
                  <AnalysisPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/recommendation"
              element={(
                <ProtectedRoute isAuthenticated={authState.isAuthenticated}>
                  <RecommendationPage />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/profile"
              element={(
                <ProtectedRoute isAuthenticated={authState.isAuthenticated}>
                  <ProfilePage user={authState.user} onProfileUpdated={onProfileUpdated} />
                </ProtectedRoute>
              )}
            />
            <Route path="*" element={<Navigate to={authState.isAuthenticated ? "/" : "/login"} replace />} />
          </Routes>
        </main>

        <footer className="app-footer">© 2026 Color Trend Analysis and WCAG Recommendation System</footer>
      </div>
    </Router>
  );
}

export default App;