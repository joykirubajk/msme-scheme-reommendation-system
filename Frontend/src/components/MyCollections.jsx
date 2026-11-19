import React, { useState, useEffect, useCallback } from 'react';
import SchemeDetails from './SchemeDetails';
import '../styles/MyCollections.css';
import { collectionAPI } from '../services/api';
import { useSavedSchemes } from '../context/SavedSchemesContext';
import { labelFor, normalizeScheme, errorMessage } from '../utils/format';

// "My Saved Schemes" modal. Save state comes from the shared context, so removing a scheme
// here updates every heart on the page, and saves made elsewhere show up here.
const MyCollections = ({ onClose }) => {
  const { savedIds, toggle, isPending, version, error: toggleError, clearError } = useSavedSchemes();
  const [schemes, setSchemes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState(null);

  const fetchSavedSchemes = useCallback(async () => {
    try {
      const response = await collectionAPI.getSavedSchemes();
      setSchemes((response?.data?.schemes || []).map(normalizeScheme));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load your saved schemes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever a save/unsave succeeds anywhere in the app
  useEffect(() => {
    fetchSavedSchemes();
  }, [fetchSavedSchemes, version]);

  // Optimistic: hide a scheme as soon as its heart is cleared
  const visible = schemes.filter((s) => savedIds.has(s.id));
  const q = searchQuery.trim().toLowerCase();
  const filteredSchemes = q
    ? visible.filter((s) => s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
    : visible;

  if (selectedScheme) {
    return (
      <div className="scheme-details-full-view">
        <SchemeDetails scheme={selectedScheme} onBack={() => setSelectedScheme(null)} />
      </div>
    );
  }

  return (
    <div className="my-collections-modal-overlay" onClick={onClose}>
      <div className="my-collections-modal" role="dialog" aria-label="My saved schemes" onClick={(e) => e.stopPropagation()}>
        <div className="collections-header">
          <h2>My Saved Schemes{!loading && ` (${visible.length})`}</h2>
          <button className="collections-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {(loadError || toggleError) && (
          <p className="collections-error" role="alert">
            {loadError || toggleError}{' '}
            {toggleError && <button type="button" className="view-btn" onClick={clearError}>Dismiss</button>}
          </p>
        )}

        {loading ? (
          <div className="collections-loading">
            <p>Loading your saved schemes...</p>
          </div>
        ) : visible.length > 0 ? (
          <>
            <div className="collections-search">
              <input
                type="text"
                placeholder="Search in saved schemes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                aria-label="Search in saved schemes"
              />
            </div>

            <div className="collections-content">
              {filteredSchemes.length > 0 ? (
                <div className="saved-schemes-list">
                  {filteredSchemes.map((scheme) => (
                    <div key={scheme.id} className="saved-scheme-item">
                      <div className="scheme-item-content">
                        <h3 className="scheme-item-name">{scheme.name}</h3>
                        <p className="scheme-item-category">
                          {labelFor(scheme.location) || 'All India'}
                          {scheme.business_category && scheme.business_category !== 'any' ? ` · ${labelFor(scheme.business_category)}` : ''}
                        </p>
                        <p className="scheme-item-desc">{scheme.description || 'No description available'}</p>
                        {scheme.saved_at && (
                          <p className="scheme-item-meta">Saved on {new Date(scheme.saved_at).toLocaleDateString('en-IN')}</p>
                        )}
                      </div>
                      <div className="scheme-item-actions">
                        <button className="view-btn" onClick={() => setSelectedScheme(scheme)}>
                          View Details
                        </button>
                        <button
                          className="remove-btn"
                          onClick={() => toggle(scheme.id)}
                          disabled={isPending(scheme.id)}
                        >
                          {isPending(scheme.id) ? '⟳ Removing...' : '✕ Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-search">
                  <p>No schemes found matching your search.</p>
                </div>
              )}
            </div>
          </>
        ) : !loadError ? (
          <div className="empty-collections">
            <div className="empty-icon">📋</div>
            <h3>No Saved Schemes Yet</h3>
            <p>Tap the ♡ on any scheme to save it here.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MyCollections;
