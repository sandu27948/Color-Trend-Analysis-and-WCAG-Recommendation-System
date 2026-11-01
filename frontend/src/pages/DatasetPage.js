import React from "react";
import Dataset from "../components/Dataset";

function DatasetPage() {
  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <span className="eyebrow">Dataset Page</span>
          <h1> Data Overview</h1>
          
        </div>
      </div>
      <Dataset />
    </section>
  );
}

export default DatasetPage;
