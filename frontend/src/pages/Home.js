import React from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <section className="page-home">
      <div className="hero-card hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">Color Trend Analysis and WCAG Recommendation</span>
          <h1>Design with confident color insights and WCAG-compliant contrast strategy.</h1>
          <p className="hero-text">
            Discover the most trusted color trends, evaluate accessibility across years and platforms, and make professional palette decisions with clean, modern guidance.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={() => navigate("/analysis")}>Analyze Colors</button>
            <button className="secondary-button" onClick={() => navigate("/dataset")}>View Dataset</button>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <strong>WCAG Ready</strong>
              <span>Contrast analysis for better readability.</span>
            </div>
            <div className="feature-card">
              <strong>Trend Intelligence</strong>
              <span>Year-by-year color usage insights.</span>
            </div>
            <div className="feature-card">
              <strong>Platform Focus</strong>
              <span>Web and mobile color compatibility.</span>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-panel-card">
            <div className="panel-heading">Visual Confidence</div>
            <div className="panel-value">95%+</div>
            <div className="panel-meta">Recommended contrast compliance across the dataset</div>
          </div>
          <div className="hero-panel-card">
            <div className="panel-heading">Platform Coverage</div>
            <div className="panel-value">Web + Mobile</div>
            <div className="panel-meta">Optimized for modern digital product workflows</div>
          </div>
          <div className="hero-panel-card accent-card">
            <div className="panel-heading">Professional Palette</div>
            <div className="panel-value">#005BAC</div>
            <div className="panel-meta">Primary trust color with accessible accents</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Home;
