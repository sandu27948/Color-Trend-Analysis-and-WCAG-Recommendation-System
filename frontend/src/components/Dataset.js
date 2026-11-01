import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000";

const initialFormState = {
  id: "",
  platform: "",
  year: "",
  primary: "",
  background: "",
  text_color: ""
};

function Dataset() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addForm, setAddForm] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(initialFormState);
  const [auditUrl, setAuditUrl] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditResult, setAuditResult] = useState(null);

  const getField = (item, keys, fallback = "—") => {
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
        return item[key];
      }
    }
    return fallback;
  };

  const normalizeHex = (value) => {
    if (!value || typeof value !== "string") return "";
    let hex = value.trim();
    if (hex.startsWith("#")) hex = hex.slice(1);
    if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
      hex = hex.split("").map((char) => char + char).join("");
    }
    if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
      return `#${hex.toUpperCase()}`;
    }
    return value.trim();
  };

  const parseDataPayload = (response) => {
    const payload = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.data?.data)
        ? response.data.data
        : [];

    return payload.filter((item) => item && item.id !== null && item.id !== undefined);
  };

  const fetchData = async ({ showLoader = false } = {}) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const res = await axios.get(`${API_BASE}/data`);
      setData(parseDataPayload(res));
      setError(null);
    } catch (err) {
      console.error("Backend Error:", err);
      const statusText = err?.response?.status ? `Status ${err.response.status}` : "Network error";
      const message = err?.response?.data?.error || err?.message || "Failed to load data.";
      setError(`${statusText}: ${message}`);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    axios.get(`${API_BASE}/data`)
      .then((res) => {
        if (!isMounted) return;
        setData(parseDataPayload(res));
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Backend Error:", err);
        const statusText = err?.response?.status ? `Status ${err.response.status}` : "Network error";
        const message = err?.response?.data?.error || err?.message || "Failed to load data.";
        setError(`${statusText}: ${message}`);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const toIdValue = (value) => {
    if (value === "" || value === null || value === undefined) return value;
    const asNumber = Number(value);
    return Number.isNaN(asNumber) ? value : asNumber;
  };

  const buildRowPayload = (form) => ({
    id: toIdValue(form.id),
    platform: form.platform?.trim() || "",
    year: form.year?.trim() || "",
    primary: normalizeHex(form.primary),
    background: normalizeHex(form.background),
    text_color: normalizeHex(form.text_color)
  });

  const handleAddInputChange = (event) => {
    const { name, value } = event.target;
    setAddForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleEditInputChange = (event) => {
    const { name, value } = event.target;
    setEditForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleAddSubmit = async (event) => {
    event.preventDefault();
    setActionError(null);
    setActionMessage("");

    if (addForm.id === "") {
      setActionError("ID is required to add a new row.");
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`${API_BASE}/update`, buildRowPayload(addForm));
      setAddForm(initialFormState);
      await fetchData();
      setActionMessage("New row added successfully.");
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Failed to add row.";
      setActionError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditRow = (item) => {
    setEditingId(item.id);
    setEditForm({
      id: item.id,
      platform: String(getField(item, ["platform", "Platform", "App Name", "app_name", "AppName", "app", "name"], "")),
      year: String(getField(item, ["year", "Year"], "")),
      primary: String(getField(item, ["primary", "Primary", "primary_color", "color", "Primary Color", "Primary Color (HEX)"], "#000000")),
      background: String(getField(item, ["background", "Background", "bg", "background_color", "Background Color"], "#FFFFFF")),
      text_color: String(getField(item, ["text_color", "Text Color", "textColor", "font_color"], "#000000"))
    });
    setActionError(null);
    setActionMessage("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(initialFormState);
  };

  const handleUpdateRow = async (rowId) => {
    setSubmitting(true);
    setActionError(null);
    setActionMessage("");

    try {
      await axios.put(`${API_BASE}/update`, buildRowPayload({ ...editForm, id: rowId }));
      await fetchData();
      setEditingId(null);
      setActionMessage("Row updated successfully.");
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Failed to update row.";
      setActionError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRow = async (rowId) => {
    const confirmed = window.confirm(`Delete row with ID ${rowId}?`);
    if (!confirmed) return;

    setSubmitting(true);
    setActionError(null);
    setActionMessage("");

    try {
      await axios.delete(`${API_BASE}/delete/${encodeURIComponent(rowId)}`);
      await fetchData();
      if (editingId === rowId) {
        cancelEdit();
      }
      setActionMessage("Row deleted successfully.");
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Failed to delete row.";
      setActionError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuditSubmit = async (event) => {
    event.preventDefault();
    setAuditError(null);
    setAuditResult(null);

    const url = auditUrl.trim();
    if (!url) {
      setAuditError("Enter a website URL to audit.");
      return;
    }

    setAuditLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/audit/url`, {
        url,
        deepScan: true,
        interactionScan: true,
        maxSamples: 120
      });
      setAuditResult(res.data);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Failed to audit website URLs.";
      setAuditError(message);
    } finally {
      setAuditLoading(false);
    }
  };

  const getLuminance = (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return null;
    const c = normalized.substring(1);
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    const values = [r, g, b].map((v) => {
      const channel = v / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };

  const getContrastRatio = (foreground, background) => {
    const fgLum = getLuminance(foreground);
    const bgLum = getLuminance(background);
    if (fgLum === null || bgLum === null) return null;
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
  };

  const getWCAGStatus = (contrast) => {
    if (!contrast) return "N/A";
    const ratio = parseFloat(contrast);
    if (ratio >= 7) return "Pass (WCAG AAA)";
    if (ratio >= 4.5) return "Pass (WCAG AA)";
    return "Fail";
  };

  const renderColorCell = (value) => {
    const normalized = normalizeHex(value);
    const isColor = /^#([0-9A-Fa-f]{6})$/.test(normalized);

    return (
      <div className="swatch-cell">
        <span className="color-chip" style={{ backgroundColor: isColor ? normalized : "#ffffff" }} />
        <span>{normalized || "—"}</span>
      </div>
    );
  };

  if (loading) return <div className="message">Loading dataset...</div>;
  if (error) return <div className="message error">{error}</div>;

  return (
    <div className="dataset-table-wrapper">
      <form className="url-audit-form" onSubmit={handleAuditSubmit}>
        <div className="section-summary">Website URL WCAG Audit</div>
        <p className="audit-helper-text">
          Enter one website URL. The system checks detected text/background color pairs,
          calculates contrast ratio, and gives WCAG AA feedback.
        </p>
        <input
          className="url-audit-input"
          type="url"
          value={auditUrl}
          onChange={(event) => setAuditUrl(event.target.value)}
          placeholder="https://example.com"
          required
        />
        <div className="dataset-form-actions">
          <button type="submit" className="primary-button" disabled={auditLoading}>
            {auditLoading ? "Auditing..." : "Audit URL"}
          </button>
        </div>
        {auditError ? <div className="message error">{auditError}</div> : null}

        {auditResult ? (
          <div className="audit-result-panel">
            <div className="summary-grid">
              <div className="summary-card total-card">
                <span>Color Pairs Checked</span>
                <strong>{auditResult?.results?.[0]?.sampledPairCount ?? 0}</strong>
                <small>Pairs included in this WCAG audit</small>
              </div>
              <div className="summary-card pass-card">
                <span>Pass WCAG AA</span>
                <strong>{auditResult?.results?.[0]?.passAA ?? 0}</strong>
                <small>Color pairs meet 4.5:1</small>
              </div>
              <div className="summary-card fail-card">
                <span>Needs Improvement</span>
                <strong>{auditResult?.results?.[0]?.failAA ?? 0}</strong>
                <small>Color pairs below 4.5:1</small>
              </div>
              <div className="summary-card invalid-card">
                <span>Errors/Unknown</span>
                <strong>{(auditResult?.summary?.errors ?? 0) + (auditResult?.summary?.unknown ?? 0)}</strong>
                <small>Audit needs review</small>
              </div>
            </div>

            <div className="audit-site-list">
              {(auditResult.results || []).map((site) => (
                <div className="audit-site-card" key={site.url}>
                  <div className="audit-site-head">
                    <strong>{site.url}</strong>
                    <span className={`audit-status-chip status-${site.overallStatus || "unknown"}`}>
                      {site.overallStatus || "unknown"}
                    </span>
                  </div>

                  {site.error ? <div className="message error">{site.error}</div> : null}

                  {!site.error ? (
                    <>
                      <div className="audit-meta-row">
                        <span>Mode: {site.auditMode || "unknown"}</span>
                        <span>Detected pairs: {site.pairCount ?? 0}</span>
                        <span>Sampled: {site.sampledPairCount ?? 0}</span>
                        <span>Pass AA: {site.passAA ?? 0}</span>
                        <span>Fail AA: {site.failAA ?? 0}</span>
                      </div>

                      {site.warning ? <div className="audit-warning">{site.warning}</div> : null}

                      <ul className="audit-feedback-list">
                        {(site.feedback || []).map((feedbackItem, index) => (
                          <li key={`${site.url}-feedback-${index}`}>{feedbackItem}</li>
                        ))}
                      </ul>

                      {site.samples?.some((sample) => sample.recommendation) ? (
                        <section className="audit-recommendations" aria-label="Improvement recommendations">
                          <div>
                            <h3>Improvement recommendations</h3>
                            <p>Use these replacement text colors for the failing pairs to meet WCAG AA.</p>
                          </div>
                          <div className="audit-recommendations-list">
                            {site.samples.filter((sample) => sample.recommendation).map((sample, recommendationIndex) => (
                              <div className="audit-recommendation" key={`${site.url}-recommendation-${recommendationIndex}`}>
                                <div className="audit-recommendation-preview" style={{ backgroundColor: sample.background, color: sample.recommendation.suggestedText }}>
                                  Aa
                                </div>
                                <div className="audit-recommendation-details">
                                  <strong>{sample.recommendation.action}</strong>
                                  <span>Current: {sample.text} on {sample.background} ({sample.contrast}:1)</span>
                                  <span>Suggested contrast: {sample.recommendation.contrast}:1, {sample.recommendation.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {site.samples?.length ? (
                        <div className="audit-samples-grid">
                          {site.samples.map((sample, sampleIndex) => (
                            <div className="audit-sample-card" key={`${site.url}-sample-${sampleIndex}`}>
                              <div className="audit-sample-preview" style={{ backgroundColor: sample.background, color: sample.text }}>
                                Aa
                              </div>
                              <div className="audit-sample-details">
                                <div className="audit-sample-status-row">
                                  <span className={`audit-pair-status ${sample.wcagAA === "Pass" ? "pair-pass" : "pair-fail"}`}>
                                    {sample.wcagAA === "Pass" ? "Pass AA" : "Fail AA"}
                                  </span>
                                  <strong>{sample.contrast ? `${sample.contrast}:1` : "N/A"}</strong>
                                </div>
                                <div className="audit-color-values">
                                  <span><i style={{ backgroundColor: sample.background }} />Background {sample.background}</span>
                                  <span><i style={{ backgroundColor: sample.text }} />Text {sample.text}</span>
                                </div>
                                {sample.sampleText ? <span className="audit-sample-text">“{sample.sampleText}”</span> : null}
                                {sample.states?.length ? <span>States: {sample.states.join(", ")}</span> : null}
                                {sample.selector ? <span>Selector: {sample.selector}</span> : null}
                                {sample.occurrences > 1 ? <span>Found {sample.occurrences} times</span> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </form>

      <form className="dataset-add-form" onSubmit={handleAddSubmit}>
        <div className="section-summary">Add new row</div>
        <div className="dataset-form-grid">
          <input
            className="field-input"
            type="text"
            name="id"
            value={addForm.id}
            onChange={handleAddInputChange}
            placeholder="ID"
            required
          />
          <input
            className="field-input"
            type="text"
            name="platform"
            value={addForm.platform}
            onChange={handleAddInputChange}
            placeholder="Platform"
          />
          <input
            className="field-input"
            type="text"
            name="year"
            value={addForm.year}
            onChange={handleAddInputChange}
            placeholder="Year"
          />
          <input
            className="field-input"
            type="text"
            name="primary"
            value={addForm.primary}
            onChange={handleAddInputChange}
            placeholder="Primary(#RRGGBB)"
          />
          <input
            className="field-input"
            type="text"
            name="background"
            value={addForm.background}
            onChange={handleAddInputChange}
            placeholder="Background(#RRGGBB)"
          />
          <input
            className="field-input"
            type="text"
            name="text_color"
            value={addForm.text_color}
            onChange={handleAddInputChange}
            placeholder="Text(#RRGGBB)"
          />
        </div>
        <div className="dataset-form-actions">
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Saving..." : "Add Data"}
          </button>
          {actionMessage ? <span className="inline-success">{actionMessage}</span> : null}
        </div>
        {actionError ? <div className="message error">{actionError}</div> : null}
      </form>

      {data.length === 0 ? (
        <div className="message">No records found in the database.</div>
      ) : (
        <>
          <div className="section-summary">Total records: {data.length}</div>
          <table className="dataset-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Platform</th>
                <th>Year</th>
                <th>Primary Color</th>
                <th>Background</th>
                <th>Text Color</th>
                <th>Contrast Ratio</th>
                <th>WCAG Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const isEditing = editingId === item.id;
                const platform = getField(item, ["Platform", "platform", "App Name", "app_name", "AppName", "app", "name"], "Unknown Platform");
                const year = getField(item, ["Year", "year"], "—");
                const primary = getField(item, ["primary", "Primary", "primary_color", "color", "Primary Color", "Primary Color (HEX)"], "#ffffff");
                const background = getField(item, ["background", "Background", "bg", "background_color", "Background Color"], "—");
                const textColor = getField(item, ["text_color", "Text Color", "textColor", "font_color", "Text Color"], "—");
                const contrast = getContrastRatio(textColor, background);
                const wcagStatus = getWCAGStatus(contrast);

                return (
                  <tr key={item.id ?? `${index}-${platform}-${year}`}>
                    <td>{item.id}</td>
                    <td>
                      {isEditing ? (
                        <input className="field-input row-input" name="platform" value={editForm.platform} onChange={handleEditInputChange} />
                      ) : platform}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="field-input row-input" name="year" value={editForm.year} onChange={handleEditInputChange} />
                      ) : year}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="field-input row-input" name="primary" value={editForm.primary} onChange={handleEditInputChange} />
                      ) : renderColorCell(primary)}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="field-input row-input" name="background" value={editForm.background} onChange={handleEditInputChange} />
                      ) : renderColorCell(background)}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="field-input row-input" name="text_color" value={editForm.text_color} onChange={handleEditInputChange} />
                      ) : renderColorCell(textColor)}
                    </td>
                    <td>{contrast ? `${contrast}:1` : "N/A"}</td>
                    <td>{wcagStatus}</td>
                    <td>
                      <div className="row-actions">
                        {isEditing ? (
                          <>
                            <button type="button" className="primary-button row-btn" disabled={submitting} onClick={() => handleUpdateRow(item.id)}>
                              Save
                            </button>
                            <button type="button" className="secondary-button row-btn" disabled={submitting} onClick={cancelEdit}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="secondary-button row-btn" disabled={submitting} onClick={() => startEditRow(item)}>
                              Update
                            </button>
                            <button type="button" className="danger-button row-btn" disabled={submitting} onClick={() => handleDeleteRow(item.id)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default Dataset;