import React, { useEffect, useState, useCallback } from "react";
import { collectionAPI, schemeAPI } from "../services/api";
import SchemeDetails from "../components/SchemeDetails.jsx";
import SaveButton from "../components/SaveButton.jsx";
import { useSavedSchemes } from "../context/SavedSchemesContext";
import { useLanguage } from "../context/LanguageContext";
import { labelFor, formatRupees, normalizeScheme, errorMessage } from "../utils/format";
import "../styles/Homepage.css";

function HomePage({ onFindSchemes, isLoggedIn, onBrowse }) {
  const { lang, t } = useLanguage();
  const { savedIds, version } = useSavedSchemes();
  const [savedSchemes, setSavedSchemes] = useState([]);
  const [totalSchemes, setTotalSchemes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState(null);

  useEffect(() => {
    schemeAPI
      .listSchemes({ limit: 1 })
      .then((res) => setTotalSchemes(res?.data?.pagination?.total ?? null))
      .catch(() => setTotalSchemes(null));
  }, []);

  // Load only the signed-in user's saved schemes for the home page section.
  const fetchSavedSchemes = useCallback(async () => {
    if (!isLoggedIn) {
      setSavedSchemes([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await collectionAPI.getSavedSchemes();
      setSavedSchemes((response?.data?.schemes || []).map(normalizeScheme));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load saved schemes. Please try again later."));
      setSavedSchemes([]);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchSavedSchemes();
  }, [fetchSavedSchemes, version]);

  const visibleSaved = savedSchemes.filter((s) => savedIds.has(s.id));

  const browse = (q = "") => {
    if (onBrowse) onBrowse(q);
  };

  const handleStartRecommendation = () => {
    if (onFindSchemes) {
      onFindSchemes();
    }
  };

  const handleLearnMore = (scheme) => {
    setSelectedScheme(scheme);
  };

  const handleBackFromSchemeDetails = () => {
    setSelectedScheme(null);
  };

  return (
    <div id="home" className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            {t("heroTitle")}
          </h1>
          <p className="hero-subtitle">
            {t("heroSubtitle")}
          </p>
          <button className="cta-btn" onClick={handleStartRecommendation}>
            {t("heroCta")}
          </button>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="scheme-stats">
        <div className="stat-item">
          <h3 className="stat-number">{totalSchemes ?? "–"}</h3>
          <p className="stat-label">Schemes Listed</p>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <p className="section-subtitle">Process</p>
        <h2 className="section-title">Easy Steps to Find & Apply for Schemes</h2>

        <div className="steps">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3 className="step-title">Enter Your Details</h3>
            <p className="step-desc">
              Provide information about your business type, turnover, and location
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3 className="step-title">Get Recommendations</h3>
            <p className="step-desc">
              Our eligibility engine checks the rules and ranks the schemes that fit you best
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3 className="step-title">Apply</h3>
            <p className="step-desc">
              Get detailed information and apply directly through the portal
            </p>
          </div>
        </div>

        <button className="cta-btn success" onClick={handleStartRecommendation}>
          Start Your Journey Now →
        </button>
      </section>

      {/* User Saved Schemes Section (only visible when logged in) */}
      {isLoggedIn && (
        <section id="schemes" className="schemes">
          <h2 className="section-title">{lang === "ta" ? "சேமித்த திட்டங்கள்" : "Your Saved Schemes"}</h2>
          <p className="section-text featured-note">
            {lang === "ta"
              ? "நீங்கள் சேமித்த திட்டங்கள் இங்கே காட்டப்படும்."
              : "Schemes you have saved for quick access. Use Browse to discover more."}
          </p>

          {loading ? (
            <div className="loading-state">
              <p>{lang === "ta" ? "சேமித்த திட்டங்களை ஏற்றுகிறது..." : "Loading saved schemes..."}</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button className="retry-btn" onClick={fetchSavedSchemes}>
                Retry
              </button>
            </div>
          ) : visibleSaved.length === 0 ? (
            <div className="empty-state">
              <p>
                {lang === "ta"
                  ? "நீங்கள் இன்னும் எந்த திட்டத்தையும் சேமிக்கவில்லை."
                  : "No saved schemes yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="schemes-grid">
                {visibleSaved.map((scheme) => (
                  <div key={scheme.id} className="scheme-card">
                    <SaveButton schemeId={scheme.id} className="card-corner" />
                    <div className="scheme-header">
                      <h3 className="scheme-name">{scheme.name}</h3>
                      <span className="scheme-category">
                        {labelFor(scheme.location) || "All India"}
                        {scheme.business_category && scheme.business_category !== "any" ? ` · ${labelFor(scheme.business_category)}` : ""}
                      </span>
                    </div>
                    <p className="scheme-description">{scheme.description || "No description available"}</p>
                    <div className="scheme-details">
                      {scheme.benefits?.subsidy_percent !== undefined && (
                        <div className="scheme-detail-item">
                          <strong>Subsidy:</strong> {scheme.benefits.subsidy_percent}%
                          {scheme.benefits.max_subsidy !== undefined && ` (up to ${formatRupees(scheme.benefits.max_subsidy)})`}
                        </div>
                      )}
                      {scheme.max_investment !== null && scheme.max_investment !== undefined && (
                        <div className="scheme-detail-item">
                          <strong>Project size up to:</strong> {formatRupees(scheme.max_investment)}
                        </div>
                      )}
                    </div>
                    <button className="learn-more-btn" onClick={() => handleLearnMore(scheme)}>Learn More →</button>
                  </div>
                ))}
              </div>

              <div className="toggle-container">
                <button className="toggle-btn" onClick={() => browse("")}>
                  Browse all {totalSchemes ?? ""} schemes →
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* About Section */}
      <section className="about">
        <div className="about-content">
          <h2 className="section-title">About This Portal</h2>
          <p className="section-text">
            The MSME Scheme Portal is your one-stop solution to discover and
            apply for government schemes designed to support Micro, Small, and
            Medium Enterprises. Whether you're looking for financial assistance,
            skill development, or technology upgrades, we help you find the
            perfect scheme for your business growth.
          </p>
          <div className="about-features">
            <div className="feature">
              <span className="feature-icon">✓</span>
              <h4>Comprehensive Database</h4>
              <p>Browse central and state schemes in one place</p>
            </div>
            <div className="feature">
              <span className="feature-icon">✓</span>
              <h4>Smart Matching</h4>
              <p>AI-powered recommendations based on your business profile</p>
            </div>
            <div className="feature">
              <span className="feature-icon">✓</span>
              <h4>Easy Application</h4>
              <p>Simplified process to apply for schemes</p>
            </div>
          </div>
        </div>
      </section>

       {/* call to action */}

      <section className="cta-section">
        <h2 className="cta-title">Ready to Grow Your Business?</h2>
        <p className="cta-subtitle">
          Tell us about your business and see which schemes you qualify for
        </p>
        <button className="cta-btn primary" onClick={handleStartRecommendation}>
          Start Recommendation Process →
        </button>
      </section>

      {/* Footer */}
      <footer id="contact" className="footer">
        <div className="footer-container">
          <div className="footer-section">
            <h3 className="footer-title">MSME Schemes</h3>
            <p className="footer-tagline">
              Empowering Indian businesses through government schemes
            </p>
          </div>

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li>
                <a href="#home">Home</a>
              </li>
              <li>
                <a href="#schemes">Featured Schemes</a>
              </li>
              <li>
                <a href="#how-it-works">How It Works</a>
              </li>
              <li>
                <a href="#contact">About</a>
              </li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>About the Data</h4>
            <p className="footer-tagline">
              Scheme details here are summaries for guidance only. Always confirm
              eligibility and benefits on the scheme's official government website
              before applying.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            © 2026 MSME Scheme Portal. Not an official government website.
          </p>
        </div>
      </footer>

      {/* Scheme Details Modal */}
      {selectedScheme && (
        <div className="scheme-details-modal-overlay" onClick={handleBackFromSchemeDetails}>
          <div className="scheme-details-modal" onClick={(e) => e.stopPropagation()}>
            <button className="scheme-details-close-btn" onClick={handleBackFromSchemeDetails}>✕</button>
            <SchemeDetails scheme={selectedScheme} onBack={handleBackFromSchemeDetails} />
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;