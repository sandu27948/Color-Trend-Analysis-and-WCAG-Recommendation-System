import React from "react";
import Analysis from "../components/Analysis";

function AnalysisPage() {
  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <span className="eyebrow">Analysis Page</span>
          <h1>Color Trend Analysis and WCAG Insights</h1>
          <p>Discover the most used colors, chart distributions, and trends across years.</p>
        </div>
      </div>
      <Analysis />
    </section>
  );
}

export default AnalysisPage;
