import React, { useState } from "react";
import axios from "axios";

const PRESET_COLORS = [
  { name: "Ocean Blue", value: "#005BAC" },
  { name: "Coral Orange", value: "#FF7A45" },
  { name: "Mint Green", value: "#20C997" },
  { name: "Sunflower", value: "#FFC107" },
  { name: "Rose", value: "#E64980" },
  { name: "Graphite", value: "#343A40" }
];

function Recommendation() {
  const [color, setColor] = useState("#ffffff");
  const [level, setLevel] = useState("AA");
  const [textSize, setTextSize] = useState("normal");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const check = async () => {
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await axios.get(`http://localhost:5000/recommend/${encodeURIComponent(color)}`, {
        params: {
          level,
          textSize
        }
      });
      setResult(res.data);
    } catch (err) {
        const message = err.response?.data?.error || "Please enter a valid HEX code (e.g. #ff0000)";
        setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isPass = Boolean(result?.status && result.status.toLowerCase().includes("pass"));

  return (
    <div className="result-card">
      <h2 className="section-title">Accessibility Recommendation</h2>
      <div className="recommendation-form">
        <div className="color-pick-shell">
          <span className="color-pick-label">Pick color</span>
          <div className="color-picker-row">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="color-picker"
            />
            <span className="color-dot" style={{ backgroundColor: color }} aria-hidden="true" />
          </div>
        </div>
        <select className="color-select" value={color} onChange={(e) => setColor(e.target.value)}>
          <option value="">Choose trendy preset</option>
          {PRESET_COLORS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.name} ({preset.value})
            </option>
          ))}
        </select>
        <div className="criteria-group" role="group" aria-label="WCAG criteria">
          <label className="criteria-label" htmlFor="wcag-level">WCAG Level</label>
          <select
            id="wcag-level"
            className="color-select criteria-select"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="AA">AA</option>
            <option value="AAA">AAA</option>
          </select>
        </div>
        <div className="criteria-group" role="group" aria-label="Text size">
          <label className="criteria-label" htmlFor="text-size">Text Size</label>
          <select
            id="text-size"
            className="color-select criteria-select"
            value={textSize}
            onChange={(e) => setTextSize(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>
        </div>
        <input
          type="text"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="#000000"
          className="field-input"
        />
        <button className="primary-button" onClick={check} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze Accessibility"}
        </button>
      </div>
      <div className="swatch-strip" aria-label="Quick color suggestions">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`swatch-btn${color.toLowerCase() === preset.value.toLowerCase() ? " active" : ""}`}
            style={{ backgroundColor: preset.value }}
            onClick={() => setColor(preset.value)}
            title={`${preset.name} ${preset.value}`}
            aria-label={`${preset.name} ${preset.value}`}
          />
        ))}
      </div>

      {error && <div className="message error">{error}</div>}

      {result && (
        <div className="palette-grid">
          <div className="palette-sample" style={{ backgroundColor: result.input, color: result.suggestedText }}>
            <span>Preview</span>
            <strong>Sample text on selected color</strong>
          </div>

          <div className="palette-card">
            <div className="palette-chip">Background: {result.input}</div>
            <div className="palette-chip">Text: {result.suggestedText}</div>
            <div className="palette-chip">Contrast: {result.contrast}</div>
            <div className={`status-pill ${isPass ? "status-pass" : "status-fail"}`}>
              {result.status}
            </div>
            <div className="palette-chip">WCAG Level: {result.level || level}</div>
            <div className="palette-chip">Text Size: {result.textSize || textSize}</div>
            <div className="palette-chip">Minimum Required: {result.threshold || "-"}:1</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Recommendation;