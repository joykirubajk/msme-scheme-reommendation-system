import React, { useState } from 'react';
import SchemeDetails from './SchemeDetails';
import SaveButton from './SaveButton';
import { useLanguage, buildTamilSchemeSummary } from '../context/LanguageContext';
import '../styles/RecommendedSchemes.css';

const FIELD_LABELS = {
  age: 'age',
  gender: 'gender',
  social_category: 'social category',
  special_category: 'special category',
  business_category: 'specific business type',
  investment: 'investment amount',
  location: 'state',
  income: 'annual income',
  education: 'education level',
  experience: 'business experience',
  previous_subsidy: 'previous subsidy received',
  is_new_enterprise: 'whether this is a new enterprise',
};

const RecommendedSchemes = ({ schemes, isLoading, rankedBy }) => {
  const { lang, t } = useLanguage();
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [expandedSchemes, setExpandedSchemes] = useState({});
  const [whyOpen, setWhyOpen] = useState({});

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
          <p>{t('loadingSchemes')}</p>
        </div>
      </div>
    );
  }

  if (!schemes || schemes.length === 0) {
    return (
      <div className="schemes-container">
        <div className="no-results">
          <p>{t('noSchemesFound')}</p>
        </div>
      </div>
    );
  }

  if (selectedScheme) {
    return (
      <SchemeDetails
        scheme={selectedScheme}
        onBack={() => setSelectedScheme(null)}
      />
    );
  }

  const eligibleCount = schemes.filter((s) => s.tier !== 'possibly_eligible').length;
  const possibleCount = schemes.filter((s) => s.tier === 'possibly_eligible').length;
  const possiblePart = possibleCount > 0 ? t('andPossiblyEligible', { possible: possibleCount }) : '';

  return (
    <div className="schemes-container">
      <div className="schemes-header">
        <h2>{t('availableSchemesTitle')}</h2>
        <p className="result-count">
          {t('foundEligibleCount', { eligible: eligibleCount, possiblePart })}
        </p>
        {rankedBy === 'fallback' && (
          <p className="ranking-notice">
            {t('fallbackNotice')}
          </p>
        )}
      </div>

      <div className="schemes-grid">
        {schemes.map((scheme) => {
          const isExpanded = expandedSchemes[scheme.id] || false;
          const simplifiedDesc = simplifyDescription(scheme.description);
          const truncatedDesc = truncateText(simplifiedDesc, 150);
          const shouldShowMore = simplifiedDesc.length > 150;
          const tamilSummary = lang === 'ta' ? buildTamilSchemeSummary(scheme) : '';

          return (
            <div key={scheme.id} className="scheme-card">
              <SaveButton schemeId={scheme.id} className="card-corner" />
              {/* Badge */}
              <div className="card-badge">
                {scheme.tier === 'possibly_eligible' ? (
                  <span className="badge-eligible badge-possible">{t('possiblyEligible')}</span>
                ) : (
                  <span className="badge-eligible">{t('eligible')}</span>
                )}
              </div>

              {typeof scheme.score === 'number' && (
                <div className="match-score" title="Relevance to your profile (not a probability)">
                  <div className="match-score-bar">
                    <div className="match-score-fill" style={{ width: `${Math.round(scheme.score * 100)}%` }}></div>
                  </div>
                  <span className="match-score-text">{t('matchLabel', { pct: Math.round(scheme.score * 100) })}</span>
                </div>
              )}

              {scheme.tier === 'possibly_eligible' && scheme.eligibility?.missingInputs?.length > 0 && (
                <p className="missing-inputs">
                  {t('addToConfirm')}{scheme.eligibility.missingInputs.map((f) => FIELD_LABELS[f] || f).join(', ')}
                </p>
              )}

              {/* Title */}
              <h3 className="scheme-title">{scheme.name}</h3>

              {/* Description */}
              <div className="description-box">
                <p className="scheme-description">
                  {isExpanded ? simplifiedDesc : truncatedDesc}
                </p>
                {tamilSummary && (
                  <p className="scheme-description" style={{ color: '#4338ca', fontWeight: 500, marginTop: '6px' }}>
                    {tamilSummary}
                  </p>
                )}
                {shouldShowMore && (
                  <button
                    className="btn-expand"
                    onClick={() => toggleExpand(scheme.id)}
                    type="button"
                  >
                    {isExpanded ? (
                      <>
                        <span>{t('showLess')}</span>
                      </>
                    ) : (
                      <>
                        <span>{t('viewMore')}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Key Benefits Highlights */}
              {(scheme.benefits?.subsidy_percent || scheme.benefits?.max_subsidy) && (
                <div className="benefits-highlight">
                  {scheme.benefits.subsidy_percent && (
                    <div className="highlight-box">
                      <div className="highlight-number">{scheme.benefits.subsidy_percent}%</div>
                      <div className="highlight-label">{t('financialSupport')}</div>
                    </div>
                  )}
                  {scheme.benefits.max_subsidy && (
                    <div className="highlight-box highlight-box-primary">
                      <div className="highlight-number">₹{(scheme.benefits.max_subsidy / 100000).toFixed(1)}L</div>
                      <div className="highlight-label">{t('maxSupport')}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Info Cards */}
              <div className="info-grid">
                {scheme.max_investment && (
                  <div className="info-card">
                    <span className="info-icon"></span>
                    <div className="info-content">
                      <div className="info-label">{t('investment')}</div>
                      <div className="info-value">₹{(scheme.max_investment / 100000).toFixed(1)}L</div>
                    </div>
                  </div>
                )}

                {scheme.location && scheme.location !== 'any' && (
                  <div className="info-card">
                    <span className="info-icon"></span>
                    <div className="info-content">
                      <div className="info-label">{t('availableIn')}</div>
                      <div className="info-value">{scheme.location.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                )}

                {scheme.business_category && scheme.business_category !== 'any' && (
                  <div className="info-card">
                    <span className="info-icon"></span>
                    <div className="info-content">
                      <div className="info-label">{t('businessType')}</div>
                      <div className="info-value">{scheme.business_category}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Special Categories Badge */}
              {scheme.beneficiary_categories && scheme.beneficiary_categories.length > 0 && (
                <div className="categories-section">
                  <p className="categories-label">{t('specialPriorityFor')}</p>
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

              {(scheme.reasons?.length > 0 || scheme.eligibility?.passedRules?.length > 0) && (
                <div className="why-matched">
                  <button
                    type="button"
                    className="btn-expand"
                    onClick={() => setWhyOpen((prev) => ({ ...prev, [scheme.id]: !prev[scheme.id] }))}
                  >
                    {whyOpen[scheme.id] ? t('hideWhyMatched') : t('whyMatched')}
                  </button>
                  {whyOpen[scheme.id] && (
                    <ul className="why-list">
                      {(scheme.reasons || []).map((r, i) => (
                        <li key={`r${i}`}>{r}</li>
                      ))}
                      {(scheme.eligibility?.passedRules || []).map((r, i) => (
                        <li key={`p${i}`} className="why-rule">&#10003; {r.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Action Button */}
              <button
                className="btn btn-details"
                onClick={() => setSelectedScheme(scheme)}
              >
                 {t('viewDetailsApply')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendedSchemes;
