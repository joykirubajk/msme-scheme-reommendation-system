import React, { useState } from 'react';
import Header from '../components/Header';
import RecommendationForm from '../components/RecommendationForm';
import RecommendedSchemes from '../components/RecommendedSchemes';
import '../styles/RecommendationPage.css';

function RecommendationPage({ isLoggedIn, user, onLogout }) {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="recommendation-page">
      {/* Unified Global Header */}
      <Header
        isLoggedIn={isLoggedIn}
        user={user}
        onLogout={onLogout}
      />

      {/* Hero Header Section */}
      <section className="recommendation-hero">
        <div className="hero-inner">
          <div className="hero-badge">
            <span>✨ AI-Powered Recommendation Engine</span>
          </div>
          <h2>Find Government Schemes Tailored For Your Business</h2>
          <p>
            Answer a few quick questions about your enterprise. Our Two-Stage AI engine verifies your eligibility against official government rules and ranks matching schemes using weighted feature matching and TF-IDF similarity.
          </p>
          <div className="hero-features">
            <div className="feature-pill">🎯 100% Verified Eligibility Rules</div>
            <div className="feature-pill">⚡ Sub-Millisecond AI Ranking (~0.3ms)</div>
            <div className="feature-pill">💰 Subsidy & Collateral-Free Loans</div>
          </div>
        </div>
      </section>

      {/* Two-Column Responsive Content Area */}
      <main className="recommendation-main">
        <div className="recommendation-split-container">
          {/* Left Column: Form */}
          <div className="form-column">
            <RecommendationForm
              onRecommendations={setRecommendations}
              onLoading={setIsLoading}
            />
          </div>

          {/* Right Column: Ranked Scheme Results */}
          <div className="results-column">
            <RecommendedSchemes
              schemes={recommendations}
              isLoading={isLoading}
            />
          </div>
        </div>
      </main>

      {/* Footer at the Very Bottom */}
      <footer className="page-footer">
        <div className="footer-bottom">
          <p>
            © 2026 MSME Scheme Portal. All rights reserved. | Developed for National Informatics Centre (NIC) & BITS Pilani
          </p>
        </div>
      </footer>
    </div>
  );
}

export default RecommendationPage;
