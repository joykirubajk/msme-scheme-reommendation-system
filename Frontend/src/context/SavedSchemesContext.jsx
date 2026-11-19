import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collectionAPI } from '../services/api';
import { errorMessage } from '../utils/format';

// One source of truth for "which schemes has this user saved", shared by every list,
// the details view and My Saved Schemes. Toggles are optimistic and roll back on failure.
const SavedSchemesContext = createContext(null);

export function SavedSchemesProvider({ isLoggedIn, onRequireLogin, children }) {
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0); // bumps after every successful change
  const pendingRef = useRef(new Set());
  const savedRef = useRef(new Set());

  // Keeps savedRef in step with state so toggle() can read the current value synchronously.
  const updateSaved = useCallback((fnOrSet) => {
    const next = typeof fnOrSet === 'function' ? fnOrSet(savedRef.current) : fnOrSet;
    savedRef.current = next;
    setSavedIds(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await collectionAPI.getSavedIds();
      updateSaved(new Set(res?.data?.ids || []));
    } catch (err) {
      setError(errorMessage(err, 'Could not load your saved schemes.'));
    }
  }, [updateSaved]);

  useEffect(() => {
    if (isLoggedIn) {
      refresh();
    } else {
      updateSaved(new Set());
      setPendingIds(new Set());
      pendingRef.current = new Set();
      setError(null);
    }
  }, [isLoggedIn, refresh, updateSaved]);

  const setPending = (id, on) => {
    const next = new Set(pendingRef.current);
    if (on) next.add(id);
    else next.delete(id);
    pendingRef.current = next;
    setPendingIds(next);
  };

  const toggle = useCallback(async (schemeId) => {
    if (!isLoggedIn) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (pendingRef.current.has(schemeId)) return; // ignore double clicks while in flight

    // Read current state from the ref: state updaters run lazily, so they can't tell us this synchronously.
    const wasSaved = savedRef.current.has(schemeId);
    updateSaved((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(schemeId);
      else next.add(schemeId);
      return next;
    });
    setPending(schemeId, true);
    setError(null);

    try {
      if (wasSaved) await collectionAPI.unsaveScheme(schemeId);
      else await collectionAPI.saveScheme(schemeId);
      setVersion((v) => v + 1);
    } catch (err) {
      // roll back
      updateSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(schemeId);
        else next.delete(schemeId);
        return next;
      });
      setError(errorMessage(err, wasSaved ? 'Could not remove the scheme.' : 'Could not save the scheme.'));
    } finally {
      setPending(schemeId, false);
    }
  }, [isLoggedIn, onRequireLogin, updateSaved]);

  const value = useMemo(() => ({
    savedIds,
    isSaved: (id) => savedIds.has(id),
    isPending: (id) => pendingIds.has(id),
    toggle,
    refresh,
    error,
    clearError: () => setError(null),
    version,
    isLoggedIn: !!isLoggedIn,
  }), [savedIds, pendingIds, toggle, refresh, error, version, isLoggedIn]);

  return <SavedSchemesContext.Provider value={value}>{children}</SavedSchemesContext.Provider>;
}

// Safe outside a provider (e.g. in isolated component tests): behaves as "nothing saved".
const fallback = {
  savedIds: new Set(),
  isSaved: () => false,
  isPending: () => false,
  toggle: async () => {},
  refresh: async () => {},
  error: null,
  clearError: () => {},
  version: 0,
  isLoggedIn: false,
};

export function useSavedSchemes() {
  return useContext(SavedSchemesContext) || fallback;
}
