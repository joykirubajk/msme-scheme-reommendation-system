import React from 'react';
import SaveButton from './SaveButton';
import { labelFor, formatRupees, normalizeScheme, officialUrl } from '../utils/format';
import '../styles/SchemeDetails.css';

const RULE_LABELS = {
  min_age: 'Minimum Age',
  max_age: 'Maximum Age',
  max_age_relaxed: 'Maximum Age (relaxed groups)',
  relaxed_age_for: 'Age Relaxation For',
  genders: 'Open To',
  states: 'State',
  min_project_cost: 'Minimum Project Cost',
  max_project_cost: 'Maximum Project Cost',
  max_annual_income: 'Maximum Annual Income',
  min_experience_years: 'Minimum Experience',
  min_education: 'Minimum Education',
  business_categories: 'Business Types',
  social_categories: 'Social Categories',
  special_categories: 'Must Belong To',
  max_previous_subsidy: 'Maximum Previous Subsidy',
  is_new_enterprise_only: 'New Enterprises Only',
  // legacy keys from older data
  max_age_general: 'Max Age (General)',
  max_age_special: 'Max Age (Special)',
  gender: 'Gender',
  state: 'State',
  domicile: 'Domicile',
  max_investment: 'Max Investment',
  max_income: 'Max Income',
  max_family_income: 'Max Family Income',
  min_experience: 'Min Experience',
  prior_subsidy_limit: 'Prior Subsidy Limit',
};

const EDUCATION_LABELS = {
  none: 'No minimum', '8th': '8th pass', '10th': '10th pass', '12th': '12th pass',
  diploma: 'Diploma', graduation: 'Graduate', postgraduation: 'Post-graduate',
};

const MONEY_KEY = /income|subsidy|cost|investment/;
const YEARS_KEY = /age|experience/;

const formatValue = (key, value) => {
  if (Array.isArray(value)) return value.map(labelFor).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'min_education') return EDUCATION_LABELS[value] || labelFor(value);
  if (typeof value === 'number' && MONEY_KEY.test(key)) return formatRupees(value);
  if (typeof value === 'number' && YEARS_KEY.test(key)) return `${value} years`;
  return labelFor(value);
};

const SchemeDetails = ({ scheme: rawScheme, onBack }) => {
  const scheme = normalizeScheme(rawScheme);
  const applyUrl = officialUrl(scheme.official_source);
  const rules = Object.entries(scheme.rules || {}).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0));

  const simplifyDescription = (description) => {
    if (!description) return '';
    return description
      .replace(/MSME|msme/g, 'business')
      .replace(/beneficiary|Beneficiary/g, 'applicant');
  };

  return (
    <div className="scheme-details-container">
      <button className="btn btn-back" onClick={onBack}>
        ← Back to Schemes
      </button>

      <div className="scheme-details-card">
        {/* Header Section */}
        <div className="details-header">
          <div className="header-content">
            <h1>{scheme.name}</h1>
            {scheme.tier === 'eligible' && <span className="eligible-badge">✓ Eligible for you</span>}
            {scheme.tier === 'possibly_eligible' && <span className="eligible-badge possible">Possibly eligible</span>}
          </div>
          <div className="details-actions">
            <SaveButton schemeId={scheme.id} withLabel />
          </div>
        </div>

        {scheme.verified === false && (
          <p className="unverified-note" role="note">
            These details have not yet been checked against the official source. Confirm them before applying.
          </p>
        )}

        {/* Description - Simplified */}
        {scheme.description && (
          <p className="scheme-summary">{simplifyDescription(scheme.description)}</p>
        )}

        {/* Key Highlights */}
        {scheme.benefits && scheme.benefits.max_subsidy && (
          <div className="highlights-box">
            <div className="highlight-item">
              <span className="highlight-icon">💰</span>
              <div className="highlight-content">
                <p className="highlight-label">Maximum Financial Support You Can Get</p>
                <p className="highlight-value">{formatRupees(scheme.benefits.max_subsidy)}</p>
              </div>
            </div>
            {scheme.benefits.subsidy_percent && (
              <div className="highlight-item">
                <span className="highlight-icon">📊</span>
                <div className="highlight-content">
                  <p className="highlight-label">Support Rate</p>
                  <p className="highlight-value">{scheme.benefits.subsidy_percent}%</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Eligibility Criteria Section */}
        <section className="details-section">
          <div className="section-header">
            <span className="section-icon">📋</span>
            <h2>Who Can Apply?</h2>
          </div>
          {rules.length > 0 ? (
            <div className="criteria-grid">
              {rules.map(([key, value]) => {
                return (
                  <div key={key} className="criteria-card">
                    <div className="criteria-header">
                      <span className="criteria-label">{RULE_LABELS[key] || labelFor(key)}</span>
                    </div>
                    <div className="criteria-value-box">
                      {key.includes('age') || key.includes('experience') ? '🎯' : '✓'}
                      <span className="criteria-value">{formatValue(key, value)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-data-message">
              <p>📌 No specific requirements. Contact the program office for details.</p>
            </div>
          )}
        </section>

        {/* Beneficiary Categories Section */}
        {scheme.beneficiary_categories && scheme.beneficiary_categories.length > 0 && (
          <section className="details-section">
            <div className="section-header">
              <span className="section-icon">👥</span>
              <h2>Special Priority Groups</h2>
            </div>
            <div className="beneficiary-grid">
              {scheme.beneficiary_categories.map((category, index) => (
                <div key={index} className="beneficiary-card">
                  <span className="beneficiary-checkmark">✓</span>
                  <span className="beneficiary-text">{labelFor(category)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Financial Benefits Section */}
        <section className="details-section">
          <div className="section-header">
            <span className="section-icon">💵</span>
            <h2>What You'll Get</h2>
          </div>
          {scheme.benefits && Object.keys(scheme.benefits).length > 0 ? (
            <div className="benefits-grid">
              {scheme.benefits.subsidy_percent && (
                <div className="benefit-card">
                  <p className="benefit-label">Support Percentage</p>
                  <p className="benefit-highlight">{scheme.benefits.subsidy_percent}%</p>
                  <p className="benefit-note">of your project cost</p>
                </div>
              )}
              {scheme.benefits.max_subsidy && (
                <div className="benefit-card benefit-card-primary">
                  <p className="benefit-label">Maximum Amount You Can Get</p>
                  <p className="benefit-highlight-large">{formatRupees(scheme.benefits.max_subsidy)}</p>
                  <p className="benefit-note-primary">as direct financial support</p>
                </div>
              )}
              {scheme.benefits.loan_amount && (
                <div className="benefit-card">
                  <p className="benefit-label">Loan Available</p>
                  <p className="benefit-highlight">{formatRupees(scheme.benefits.loan_amount)}</p>
                  <p className="benefit-note">for your project needs</p>
                </div>
              )}
            </div>
          ) : (
            <div className="no-data-message">
              <p>📌 Benefit details not available. Contact the program office.</p>
            </div>
          )}
        </section>

        {/* Program Details Section */}
        <section className="details-section">
          <div className="section-header">
            <span className="section-icon">ℹ️</span>
            <h2>Program Details</h2>
          </div>
          <div className="details-grid">
            {scheme.business_category && scheme.business_category !== 'any' && (
              <div className="detail-item">
                <span className="detail-icon">🏢</span>
                <div className="detail-content">
                  <p className="detail-label">Business Type</p>
                  <p className="detail-value">{labelFor(scheme.business_category)}</p>
                </div>
              </div>
            )}
            {scheme.location && scheme.location !== 'any' && (
              <div className="detail-item">
                <span className="detail-icon">📍</span>
                <div className="detail-content">
                  <p className="detail-label">Available In State</p>
                  <p className="detail-value">{labelFor(scheme.location)}</p>
                </div>
              </div>
            )}
            {scheme.max_investment && (
              <div className="detail-item">
                <span className="detail-icon">💼</span>
                <div className="detail-content">
                  <p className="detail-label">Project Cost Limit</p>
                  <p className="detail-value">{formatRupees(scheme.max_investment)}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* How to Apply Section */}
        <section className="details-section">
          <div className="section-header">
            <span className="section-icon">🚀</span>
            <h2>How to Apply - Simple Steps</h2>
          </div>
          <ol className="steps-list">
            <li>
              <span className="step-number">1</span>
              <div className="step-content">
                <p className="step-title">Check If You Qualify</p>
                <p className="step-desc">Review the "Who Can Apply?" section above to confirm you meet the requirements</p>
              </div>
            </li>
            <li>
              <span className="step-number">2</span>
              <div className="step-content">
                <p className="step-title">Get Your Documents Ready</p>
                <p className="step-desc">Prepare your ID proof, business plan, financial statements, and other required documents</p>
              </div>
            </li>
            <li>
              <span className="step-number">3</span>
              <div className="step-content">
                <p className="step-title">Visit the Official Website</p>
                <p className="step-desc">Go to the government program website and create your account</p>
              </div>
            </li>
            <li>
              <span className="step-number">4</span>
              <div className="step-content">
                <p className="step-title">Fill Out the Application</p>
                <p className="step-desc">Complete all required fields with accurate information about your business</p>
              </div>
            </li>
            <li>
              <span className="step-number">5</span>
              <div className="step-content">
                <p className="step-title">Submit & Track Progress</p>
                <p className="step-desc">Submit your application and use the reference number to check status</p>
              </div>
            </li>
          </ol>
        </section>

        {/* CTA Section */}
        <div className="cta-section">
          <h3>Ready to Apply?</h3>
          <p>Applications are made on the official government portal for this scheme.</p>
          {applyUrl ? (
            <a className="btn btn-apply" href={applyUrl} target="_blank" rel="noopener noreferrer">
              📝 Open Official Website
            </a>
          ) : (
            <p className="cta-note">Official link not available yet. Search for the scheme name on the relevant government portal.</p>
          )}
          {applyUrl && <p className="cta-note">ℹ️ Opens the official website in a new tab.</p>}
        </div>
      </div>
    </div>
  );
};

export default SchemeDetails;
