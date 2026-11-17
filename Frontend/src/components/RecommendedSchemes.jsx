import React, { useState, useEffect, useCallback } from 'react';
import SchemeDetails from './SchemeDetails';
import { collectionAPI, authAPI } from '../services/api';
import '../styles/RecommendedSchemes.css';

const RecommendedSchemes = ({ schemes, isLoading }) => {
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [expandedSchemes, setExpandedSchemes] = useState({});
  const [savedSchemeIds, setSavedSchemeIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);

  const fetchSavedStatus = useCallback(async () => {
    if (authAPI.isLoggedIn()) {
      try {
        const res = await collectionAPI.getSavedSchemes();
        const schemesList = res?.data?.schemes || [];
        setSavedSchemeIds(new Set(schemesList.map((s) => s.id)));
      } catch (err) {
        // silent fail if unauthorized
      }
    } else {
      setSavedSchemeIds(new Set());
    }
  }, []);

  useEffect(() => {
    fetchSavedStatus();
    const handleUpdate = () => fetchSavedStatus();
    window.addEventListener('savedSchemesUpdated', handleUpdate);
    return () => window.removeEventListener('savedSchemesUpdated', handleUpdate);
  }, [fetchSavedStatus]);

  const handleToggleSave = async (scheme) => {
    if (!authAPI.isLoggedIn()) {
      alert('Please sign in to save schemes to your personal collection.');
      return;
    }

    const isSaved = savedSchemeIds.has(scheme.id);
    setSavingId(scheme.id);

    try {
      if (isSaved) {
        await collectionAPI.unsaveScheme(scheme.id);
        setSavedSchemeIds((prev) => {
          const next = new Set(prev);
          next.delete(scheme.id);
          return next;
        });
      } else {
        await collectionAPI.saveScheme(scheme.id);
        setSavedSchemeIds((prev) => new Set(prev).add(scheme.id));
      }
      window.dispatchEvent(new CustomEvent('savedSchemesUpdated', { detail: { schemeId: scheme.id } }));
    } catch (err) {
      console.error('Error toggling save scheme:', err);
    } finally {
      setSavingId(null);
    }
  };

  const toggleExpand = (schemeId) => {
    setExpandedSchemes((prev) => ({
      ...prev,
      [schemeId]: !prev[schemeId],
    }));
  };

  const simplifyDescription = (description) => {
    if (!description) return '';
    return description
      .replace(/MSME|msme/g, 'business')
      .replace(/subsidy|Subsidy/g, 'financial support')
      .replace(/entrepreneur|Entrepreneur/g, 'business owner')
      .replace(/beneficiary|Beneficiary/g, 'applicant')
      .replace(/eligible|Eligible/g, 'qualified');
  };

  const truncateText = (text, limit = 150) => {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit).trim() + '...' : text;
  };

  if (isLoading) {
    return (
      <div className="schemes-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Finding eligible schemes for you...</p>
        </div>
      </div>
    );
  }

  if (!schemes || schemes.length === 0) {
    return (
      <div className="schemes-container">
        <div className="no-results">
          <p> No schemes found for your criteria. Try adjusting your inputs.</p>
        </div>
      </div>
    );
  }

  if (selectedScheme) {
    return (
      <SchemeDetails
        scheme={selectedScheme}
        onBack={() => setSelectedScheme(null)}
        isSaved={savedSchemeIds.has(selectedScheme.id)}
        onToggleSave={() => handleToggleSave(selectedScheme)}
        isSaving={savingId === selectedScheme.id}
      />
    );
  }

  return (
    <div className="schemes-container">
      <div className="schemes-header">
        <h2> Available Schemes for You</h2>
        <p className="result-count">Found <strong>{schemes.length}</strong> eligible scheme(s) that match your profile</p>
      </div>

      <div className="schemes-grid">
        {schemes.map((scheme) => {
          const isExpanded = expandedSchemes[scheme.id] || false;
          const isSaved = savedSchemeIds.has(scheme.id);
          const isCurrentlySaving = savingId === scheme.id;
          const simplifiedDesc = simplifyDescription(scheme.description);
          const truncatedDesc = truncateText(simplifiedDesc, 150);
          const shouldShowMore = simplifiedDesc.length > 150;

          return (
            <div key={scheme.id} className="scheme-card">
              {/* ML Rank Badge & Match Score & Save Bookmark Button */}
              <div className="card-top-row">
                <span className="badge-eligible">
                  {scheme.ranking_score ? `Rank #${schemes.indexOf(scheme) + 1} • ${scheme.match_percentage || Math.round(scheme.ranking_score * 100)}% Match` : 'Eligible Match'}
                </span>
                <button
                  type="button"
                  className={`save-scheme-btn-rec ${isSaved ? 'saved' : ''}`}
                  title={isSaved ? 'Remove from Saved Schemes' : 'Save to My Schemes'}
                  onClick={() => handleToggleSave(scheme)}
                  disabled={isCurrentlySaving}
                >
                  {isCurrentlySaving ? '⟳' : isSaved ? '✓' : '🔖'}
                </button>
              </div>

              {/* Title */}
              <h3 className="scheme-title">{scheme.name}</h3>

              {/* ML Explainable Match Reasons */}
              {scheme.match_reasons && scheme.match_reasons.length > 0 && (
                <div className="ml-match-reasons-box" style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                  fontSize: '12.5px',
                  color: '#166534'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🤖 AI Recommendation Reason:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {scheme.match_reasons.map((reason, idx) => (
                      <li key={idx} style={{ margin: '2px 0' }}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Description */}
              <div className="description-box">
                <p className="scheme-description">
                  {isExpanded ? simplifiedDesc : truncatedDesc}
                </p>
                {shouldShowMore && (
                  <button
                    className="btn-expand"
                    onClick={() => toggleExpand(scheme.id)}
                    type="button"
                  >
                    {isExpanded ? (
                      <>
                        <span> Show Less</span>
                      </>
                    ) : (
                      <>
                        <span> View More</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Key Benefits Highlights */}
              <div className="benefits-highlight">
                {scheme.benefits && scheme.benefits.subsidy_percent && (
                  <div className="highlight-box">
                    <div className="highlight-number">{scheme.benefits.subsidy_percent}%</div>
                    <div className="highlight-label">Financial Support</div>
                  </div>
                )}
                {scheme.benefits && scheme.benefits.max_subsidy && (
                  <div className="highlight-box highlight-box-primary">
                    <div className="highlight-number">₹{(scheme.benefits.max_subsidy / 100000).toFixed(1)}L</div>
                    <div className="highlight-label">Max Support</div>
                  </div>
                )}
              </div>

              {/* Quick Info Cards */}
              <div className="info-grid">
                {scheme.max_investment && (
                  <div className="info-card">
                    <span className="info-icon"></span>
                    <div className="info-content">
                      <div className="info-label">Investment</div>
                      <div className="info-value">₹{(scheme.max_investment / 100000).toFixed(1)}L</div>
                    </div>
                  </div>
                )}

                {scheme.location && scheme.location !== 'any' && (
                  <div className="info-card">
                    <span className="info-icon"></span>
                    <div className="info-content">
                      <div className="info-label">Available In</div>
                      <div className="info-value">{scheme.location.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                )}

                {scheme.business_category && scheme.business_category !== 'any' && (
                  <div className="info-card">
                    <span className="info-icon"></span>
                    <div className="info-content">
                      <div className="info-label">Business Type</div>
                      <div className="info-value">{scheme.business_category}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Special Categories Badge */}
              {scheme.beneficiary_categories && scheme.beneficiary_categories.length > 0 && (
                <div className="categories-section">
                  <p className="categories-label"> Special Priority For:</p>
                  <div className="categories-tags">
                    {scheme.beneficiary_categories.slice(0, 3).map((category, index) => {
                      const categoryLabels = {
                        'sc_st': 'SC/ST',
                        'transgender': 'Transgender',
                        'pwd': 'PWD',
                        'widow': 'Widows',
                        'bpl_women': 'BPL Women'
                      };
                      return (
                        <span key={index} className="category-tag">
                          {categoryLabels[category] || category}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons: View Details & Save */}
              <div className="card-actions-row">
                <button
                  className="btn btn-details"
                  onClick={() => setSelectedScheme(scheme)}
                >
                  View Details & Apply
                </button>
                <button
                  type="button"
                  className={`btn-save-action ${isSaved ? 'btn-saved' : ''}`}
                  onClick={() => handleToggleSave(scheme)}
                  disabled={isCurrentlySaving}
                  title={isSaved ? 'Remove from your saved schemes' : 'Save to your personal collection'}
                >
                  {isCurrentlySaving ? (
                    '⟳ Saving...'
                  ) : isSaved ? (
                    <>
                      <span>✓</span> Saved
                    </>
                  ) : (
                    <>
                      <span>🔖</span> Save
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendedSchemes;
