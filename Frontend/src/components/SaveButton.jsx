import React from 'react';
import { useSavedSchemes } from '../context/SavedSchemesContext';
import '../styles/SaveButton.css';

// Heart toggle used on every scheme card and in the details view.
// Logged-out users are sent to sign in (handled by the context).
const SaveButton = ({ schemeId, withLabel = false, className = '' }) => {
  const { isSaved, isPending, toggle, isLoggedIn } = useSavedSchemes();
  const saved = isSaved(schemeId);
  const pending = isPending(schemeId);
  const label = !isLoggedIn ? 'Sign in to save this scheme' : saved ? 'Remove from saved schemes' : 'Save this scheme';

  return (
    <button
      type="button"
      className={`save-btn ${saved ? 'is-saved' : ''} ${withLabel ? 'with-label' : ''} ${className}`.trim()}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        toggle(schemeId);
      }}
    >
      <span className="save-btn-icon" aria-hidden="true">{saved ? '♥' : '♡'}</span>
      {withLabel && <span className="save-btn-text">{saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
};

export default SaveButton;
