import React, { useEffect, useState } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

function Analysis() {
  const [analysis, setAnalysis] = useState({ frequency: {}, yearWise: {} });
  const [level, setLevel] = useState("AA");
  const [textSize, setTextSize] = useState("normal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    axios.get("http://localhost:5000/analysis", {
      params: {
        level,
        textSize
      }
    })
      .then((res) => setAnalysis(res.data))
      .catch(() => setError("Unable to load analysis. Start the backend and refresh."))
      .finally(() => setLoading(false));
  }, [level, textSize]);

  const frequency = analysis.frequency || {};
  const yearWise = analysis.yearWise || {};
  const total = Object.values(frequency).reduce((sum, value) => sum + value, 0);
  
  const allColors = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .map(([color, count]) => ({
      name: color,
      value: count,
      percentage: total ? ((count / total) * 100).toFixed(1) : 0,
      fill: color
    }));

  const topColors = allColors.slice(0, 6);
  const accessibility = analysis.accessibility || { total: 0, passAA: 0, failAA: 0, invalid: 0 };
  const accessibilityByYear = analysis.accessibilityByYear || {};
  const platformAnalysis = analysis.platformAnalysis || {};
  const wcagCriteria = analysis.wcagCriteria || { level, textSize, threshold: level === "AAA" ? (textSize === "large" ? 4.5 : 7) : (textSize === "large" ? 3 : 4.5) };
  const criteriaLabel = `WCAG ${wcagCriteria.level} - ${wcagCriteria.textSize} text (${wcagCriteria.threshold}:1)`;

  const yearEntries = Object.entries(yearWise)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const accessYearEntries = Object.entries(accessibilityByYear)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const platformEntries = Object.entries(platformAnalysis)
    .sort((a, b) => b[1].total - a[1].total);

  const RADIAN = Math.PI / 180;

  const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, name, percentage }) => {
    const radius = outerRadius + 18;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? "start" : "end";

    return (
      <text x={x} y={y} fill="#1f2937" textAnchor={textAnchor} dominantBaseline="central" fontSize={13} fontWeight={500}>
        {`${name} ${percentage}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: "#fff",
          padding: "8px 12px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
        }}>
          <p style={{ margin: 0, fontWeight: "bold" }}>{payload[0].name}</p>
          <p style={{ margin: "4px 0", color: "#666" }}>Count: {payload[0].value}</p>
          <p style={{ margin: "4px 0", color: "#666" }}>Percentage: {payload[0].payload.percentage}%</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="message">Loading analysis...</div>;
  if (error) return <div className="message error">{error}</div>;

  return (
    <div className="analysis-grid">
      <div className="chart-card" style={{ gridColumn: "1 / -1" }}>
        <div className="analysis-controls">
          <div className="criteria-group" role="group" aria-label="Analysis WCAG criteria">
            <label className="criteria-label" htmlFor="analysis-level">WCAG Level</label>
            <select
              id="analysis-level"
              className="color-select criteria-select"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="AA">AA</option>
              <option value="AAA">AAA</option>
            </select>
          </div>
          <div className="criteria-group" role="group" aria-label="Analysis text size">
            <label className="criteria-label" htmlFor="analysis-text-size">Text Size</label>
            <select
              id="analysis-text-size"
              className="color-select criteria-select"
              value={textSize}
              onChange={(e) => setTextSize(e.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="large">Large</option>
            </select>
          </div>
          <div className="criteria-note" aria-live="polite">{criteriaLabel}</div>
        </div>
        <h2 className="section-title">Color Frequency - Pie Chart (All Colors)</h2>
        <p className="chart-subtitle">See the full color distribution with clear slice labels and percentage breakdowns.</p>
        {allColors.length === 0 ? (
          <p>No color frequency data available.</p>
        ) : (
          <div className="pie-chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allColors}
                  cx="50%"
                  cy="50%"
                  labelLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                  label={renderCustomizedLabel}
                  outerRadius={210}
                  innerRadius={96}
                  paddingAngle={5}
                  minAngle={4}
                  isAnimationActive={false}
                  dataKey="value"
                >
                  {allColors.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={44} iconType="circle" iconSize={12} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="analysis-section">
        <h2 className="section-title">All Colors (Sorted by Frequency)</h2>
        {allColors.length === 0 ? (
          <p>No color frequency data available.</p>
        ) : (
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            <ul className="top-color-list">
              {allColors.map(({ name: color, value: count, percentage }) => (
                <li key={color} style={{ padding: "8px", borderBottom: "1px solid #eee" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="pie-dot" style={{ backgroundColor: color, width: "16px", height: "16px", borderRadius: "50%" }} />
                      <strong>{color}</strong>
                    </span>
                    <span style={{ color: "#666", fontSize: "0.9em" }}>{count} ({percentage}%)</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="chart-card">
        <h2 className="section-title">Top 6 Colors - Bar Chart</h2>
        {topColors.length === 0 ? (
          <p>No chart data available.</p>
        ) : (
          <div className="chart-bar-row">
            {topColors.map(({ name: color, value: count, percentage }) => (
              <div key={color} className="chart-bar">
                <div style={{ flex: `${count}`, minWidth: "80px", color: "var(--text)" }}>
                  {color}
                </div>
                <div className="color-bar" style={{ width: `${percentage}%`, backgroundColor: color || "var(--primary)", minHeight: "24px" }} />
                <div style={{ minWidth: "44px", textAlign: "right", color: "var(--muted)" }}>{percentage}%</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chart-card" style={{ gridColumn: "1 / -1" }}>
        <h2 className="section-title">WCAG Accessibility Summary</h2>
        <p className="section-summary">Accessibility results are calculated from available background/text pairs using {criteriaLabel}.</p>
        <div className="summary-grid">
          <div className="summary-card pass-card">
            <strong>{accessibility.passAA}</strong>
            <span>Pass</span>
          </div>
          <div className="summary-card fail-card">
            <strong>{accessibility.failAA}</strong>
            <span>Fail</span>
          </div>
          <div className="summary-card invalid-card">
            <strong>{accessibility.invalid}</strong>
            <span>Invalid / Missing</span>
          </div>
          <div className="summary-card total-card">
            <strong>{accessibility.total}</strong>
            <span>Total checks</span>
          </div>
        </div>
      </div>

      <div className="chart-card">
        <h2 className="section-title">Trend vs Accessibility</h2>
        {accessYearEntries.length === 0 ? (
          <p>No accessibility trend data available.</p>
        ) : (
          <ul className="trends-list">
            {accessYearEntries.map(([year, stats]) => {
              const passRate = stats.total ? Math.round((stats.passAA / stats.total) * 100) : 0;
              return (
                <li key={year} className="trend-row">
                  <div>
                    <strong>{year}</strong>
                    <div className="trend-subtext">{stats.total} checks</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div><strong>{passRate}%</strong> pass</div>
                    <div className="trend-subtext">{stats.failAA} fail ({wcagCriteria.level}/{wcagCriteria.textSize})</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="chart-card">
        <h2 className="section-title">Platform Accessibility Analysis</h2>
        {platformEntries.length === 0 ? (
          <p>No platform data available.</p>
        ) : (
          <ul className="platform-list">
            {platformEntries.map(([platform, stats]) => {
              const passRate = stats.total ? Math.round((stats.passAA / stats.total) * 100) : 0;
              return (
                <li key={platform} className="platform-row">
                  <div>
                    <strong>{platform}</strong>
                    <div className="trend-subtext">{stats.total} entries</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div><strong>{passRate}%</strong> pass</div>
                    <div className="trend-subtext">{stats.failAA} fail ({wcagCriteria.level}/{wcagCriteria.textSize})</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="chart-card">
        <h2 className="section-title">Trends 2015–2025</h2>
        {yearEntries.length === 0 ? (
          <p>No trend data available.</p>
        ) : (
          <ul className="trends-list">
            {yearEntries.map(([year, colors]) => (
              <li key={year} className="trend-row">
                <div>
                  <strong>{year}</strong>
                </div>
                <div>{Object.keys(colors).length} colors</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Analysis;