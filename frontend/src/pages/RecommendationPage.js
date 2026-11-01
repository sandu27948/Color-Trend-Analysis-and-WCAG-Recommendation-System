import React from "react";
import Recommendation from "../components/Recommendation";

function RecommendationPage() {
  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <span className="eyebrow">Recommendation Page</span>
          <h1>Color Accessibility Recommendation</h1>
          <p>Select a color and WCAG criteria (AA or AAA, normal or large text) to get accurate contrast compliance results.</p>
        </div>
      </div>
      <Recommendation />
    </section>
  );
}

export default RecommendationPage;
