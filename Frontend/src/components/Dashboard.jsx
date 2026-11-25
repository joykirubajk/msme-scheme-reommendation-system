import React, { useCallback, useEffect, useState } from 'react';
import SchemeDetails from './SchemeDetails';
import SaveButton from './SaveButton';
import { collectionAPI, profileAPI, schemeAPI } from '../services/api';
import { useSavedSchemes } from '../context/SavedSchemesContext';
import { useLanguage, LanguageToggle } from '../context/LanguageContext';
import { labelFor, formatRupees, normalizeScheme, errorMessage } from '../utils/format';
import '../styles/Dashboard.css';

const TOP_MATCHES = 5;
const RECENT_SAVED = 5;

// Profile fields shown in the summary card, in display order.
const PROFILE_FIELDS = [
  ['business_category', 'Business type', labelFor],
  ['state', 'State', labelFor],
  ['investment', 'Planned investment', formatRupees],
  ['annual_income', 'Annual income', formatRupees],
  ['experience_years', 'Experience', (v) => `${v} year${Number(v) === 1 ? '' : 's'}`],
  ['education', 'Education', labelFor],
  ['social_category', 'Social category', labelFor],
  ['is_new_enterprise', 'New enterprise', (v) => (v ? 'Yes' : 'No')],
];

const hasValue = (v) => v !== null && v !== undefined && v !== '';

// Signed-in user's overview: profile summary, top matches from the saved profile, and recent saves.
function Dashboard({ user, onBack, onFindSchemes, onBrowse, onAdmin }) {
  const { savedIds, version } = useSavedSchemes();
  const { t } = useLanguage();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const [matches, setMatches] = useState(null); // null = not loaded / no profile
  const [matchMeta, setMatchMeta] = useState({ eligible: 0, possible: 0, rankedBy: null });
  const [matchError, setMatchError] = useState(null);

  const [saved, setSaved] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState(null);

  const [totalSchemes, setTotalSchemes] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState(null);

  const loadProfileAndMatches = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    setMatchError(null);
    try {
      const res = await profileAPI.getProfile();
      const p = res?.data?.profile || null;
      setProfile(p);
      if (!p) {
        setMatches(null);
        return;
      }
      try {
        // No profile in the body: the backend ranks against the saved profile.
        const rec = await schemeAPI.recommendSchemes({});
        setMatches((rec?.data || []).map(normalizeScheme));
        setMatchMeta({
          eligible: rec?.eligible_count ?? 0,
          possible: rec?.possible_count ?? 0,
          rankedBy: rec?.ranked_by || null,
        });
      } catch (err) {
        setMatches(null);
        setMatchError(errorMessage(err, 'Could not load your recommendations.'));
      }
    } catch (err) {
      setProfileError(errorMessage(err, 'Could not load your business profile.'));
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      const res = await collectionAPI.getSavedSchemes();
      setSaved((res?.data?.schemes || []).map(normalizeScheme));
      setSavedError(null);
    } catch (err) {
      setSavedError(errorMessage(err, 'Could not load your saved schemes.'));
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileAndMatches();
    schemeAPI
      .listSchemes({ limit: 1 })
      .then((res) => setTotalSchemes(res?.data?.pagination?.total ?? null))
      .catch(() => setTotalSchemes(null));
  }, [loadProfileAndMatches]);

  // Reload saved schemes whenever a save/unsave succeeds anywhere in the app.
  useEffect(() => {
    loadSaved();
  }, [loadSaved, version]);

  const visibleSaved = saved
    .filter((s) => savedIds.has(s.id))
    .sort((a, b) => new Date(b.saved_at || 0) - new Date(a.saved_at || 0));

  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'there';
  const profileFields = profile ? PROFILE_FIELDS.filter(([key]) => hasValue(profile[key])) : [];

  const stats = [
    { label: t('dashEligible'), value: matches ? matchMeta.eligible : '–' },
    { label: t('dashPossible'), value: matches ? matchMeta.possible : '–' },
    { label: t('dashSaved'), value: savedLoading ? '–' : visibleSaved.length },
    { label: t('dashListed'), value: totalSchemes ?? '–' },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <button type="button" className="dashboard-back" onClick={onBack}>
          {t('dashHome')}
        </button>
        <div style={{ flex: 1 }}>
          <h1>{t('dashHello', { name: firstName })}</h1>
          <p className="dashboard-subtitle">{t('dashSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <LanguageToggle />
          {user?.role === 'admin' && onAdmin && (
            <button type="button" className="dashboard-back" onClick={onAdmin}>
              {t('dashAdmin')}
            </button>
          )}
        </div>
      </header>

      <section className="dashboard-stats" aria-label="Summary">
        {stats.map((s) => (
          <div key={s.label} className="dashboard-stat">
            <span className="dashboard-stat-value">{s.value}</span>
            <span className="dashboard-stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      <div className="dashboard-grid">
        {/* Business profile */}
        <section className="dashboard-card dashboard-profile">
          <div className="dashboard-card-head">
            <h2>Business profile</h2>
            {profile && (
              <button type="button" className="dashboard-link-btn" onClick={onFindSchemes}>
                Update
              </button>
            )}
          </div>

          {profileLoading ? (
            <p className="dashboard-muted">Loading your profile...</p>
          ) : profileError ? (
            <div className="dashboard-error" role="alert">
              <p>{profileError}</p>
              <button type="button" className="dashboard-link-btn" onClick={loadProfileAndMatches}>Retry</button>
            </div>
          ) : profile ? (
            <>
              <dl className="dashboard-profile-list">
                {profileFields.map(([key, label, fmt]) => (
                  <div key={key} className="dashboard-profile-row">
                    <dt>{label}</dt>
                    <dd>{fmt(profile[key])}</dd>
                  </div>
                ))}
              </dl>
              {profile.updated_at && (
                <p className="dashboard-muted dashboard-small">
                  Last updated {new Date(profile.updated_at).toLocaleDateString('en-IN')}
                </p>
              )}
            </>
          ) : (
            <div className="dashboard-empty">
              <p>You haven't saved a business profile yet. Fill in the recommendation form and keep "Save these details" ticked to see your matches here.</p>
              <button type="button" className="dashboard-primary-btn" onClick={onFindSchemes}>
                Find your schemes
              </button>
            </div>
          )}
        </section>

        {/* Top matches */}
        <section className="dashboard-card dashboard-matches">
          <div className="dashboard-card-head">
            <h2>Top matches for you</h2>
            {matchMeta.rankedBy && matches && (
              <span className="dashboard-badge" title="How these were ranked">
                {matchMeta.rankedBy === 'ml' ? 'ML ranked' : 'Rule ranked'}
              </span>
            )}
          </div>

          {profileLoading ? (
            <p className="dashboard-muted">Finding schemes for your profile...</p>
          ) : matchError ? (
            <div className="dashboard-error" role="alert">
              <p>{matchError}</p>
              <button type="button" className="dashboard-link-btn" onClick={onFindSchemes}>Complete your profile</button>
            </div>
          ) : !profile ? (
            <p className="dashboard-muted">Save a business profile to see the schemes you qualify for.</p>
          ) : matches && matches.length === 0 ? (
            <p className="dashboard-muted">No schemes match your current profile. Try updating it.</p>
          ) : matches ? (
            <>
              <ul className="dashboard-match-list">
                {matches.slice(0, TOP_MATCHES).map((scheme) => (
                  <li key={scheme.id} className="dashboard-match">
                    <div className="dashboard-match-main">
                      <div className="dashboard-match-title">
                        <h3>{scheme.name}</h3>
                        <span className={`dashboard-tier ${scheme.tier === 'possibly_eligible' ? 'possible' : 'eligible'}`}>
                          {scheme.tier === 'possibly_eligible' ? 'Possibly eligible' : 'Eligible'}
                        </span>
                      </div>
                      <p className="dashboard-muted dashboard-small">
                        {labelFor(scheme.location) || 'All India'}
                        {scheme.business_category && scheme.business_category !== 'any' ? ` · ${labelFor(scheme.business_category)}` : ''}
                      </p>
                      {scheme.reasons?.[0] && <p className="dashboard-reason">{scheme.reasons[0]}</p>}
                      {typeof scheme.score === 'number' && (
                        <div className="dashboard-score" title="Relevance to your profile (not a probability)">
                          <div className="dashboard-score-bar">
                            <div className="dashboard-score-fill" style={{ width: `${Math.round(scheme.score * 100)}%` }} />
                          </div>
                          <span>Match {Math.round(scheme.score * 100)}%</span>
                        </div>
                      )}
                    </div>
                    <div className="dashboard-match-actions">
                      <SaveButton schemeId={scheme.id} />
                      <button type="button" className="dashboard-link-btn" onClick={() => setSelectedScheme(scheme)}>
                        Details
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {matches.length > TOP_MATCHES && (
                <button type="button" className="dashboard-link-btn dashboard-more" onClick={onFindSchemes}>
                  See all {matches.length} matches →
                </button>
              )}
            </>
          ) : null}
        </section>

        {/* Recently saved */}
        <section className="dashboard-card dashboard-saved">
          <div className="dashboard-card-head">
            <h2>Recently saved</h2>
            <button type="button" className="dashboard-link-btn" onClick={() => onBrowse('')}>
              Browse schemes
            </button>
          </div>

          {savedLoading ? (
            <p className="dashboard-muted">Loading saved schemes...</p>
          ) : savedError ? (
            <div className="dashboard-error" role="alert">
              <p>{savedError}</p>
              <button type="button" className="dashboard-link-btn" onClick={loadSaved}>Retry</button>
            </div>
          ) : visibleSaved.length === 0 ? (
            <p className="dashboard-muted">Nothing saved yet. Tap the ♡ on any scheme to keep it here.</p>
          ) : (
            <ul className="dashboard-saved-list">
              {visibleSaved.slice(0, RECENT_SAVED).map((scheme) => (
                <li key={scheme.id} className="dashboard-saved-item">
                  <button type="button" className="dashboard-saved-name" onClick={() => setSelectedScheme(scheme)}>
                    {scheme.name}
                  </button>
                  {scheme.saved_at && (
                    <span className="dashboard-muted dashboard-small">
                      {new Date(scheme.saved_at).toLocaleDateString('en-IN')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedScheme && (
        <div className="scheme-details-modal-overlay" onClick={() => setSelectedScheme(null)}>
          <div className="scheme-details-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="scheme-details-close-btn" onClick={() => setSelectedScheme(null)} aria-label="Close">
              ✕
            </button>
            <SchemeDetails scheme={selectedScheme} onBack={() => setSelectedScheme(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
