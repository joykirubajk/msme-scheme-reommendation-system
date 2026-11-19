import React, { useCallback, useEffect, useRef, useState } from 'react';
import { schemeAPI } from '../services/api';
import { labelFor, formatRupees, normalizeScheme, errorMessage } from '../utils/format';
import SaveButton from './SaveButton';
import SchemeDetails from './SchemeDetails';
import '../styles/DiscoverSchemes.css';

const PAGE_SIZE = 12;
const EMPTY_FILTERS = { q: '', category: '', state: '', investment: '', sort: 'name' };

const SORT_LABELS = {
  name: 'Name (A-Z)',
  investment: 'Largest project size',
  newest: 'Recently added',
};

// Browse every scheme with server-side search, filters and "load more" pagination.
const DiscoverSchemes = ({ initialQuery = '', onBack }) => {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, q: initialQuery });
  const [debouncedQ, setDebouncedQ] = useState(initialQuery);
  const [options, setOptions] = useState({ categories: [], locations: [] });
  const [schemes, setSchemes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }, []);

  // Dropdown values come from the database
  useEffect(() => {
    schemeAPI.getFilterOptions()
      .then((res) => setOptions({ categories: res?.data?.categories || [], locations: res?.data?.locations || [] }))
      .catch(() => setOptions({ categories: [], locations: [] }));
  }, []);

  // Debounce typing in the search box
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  const investmentValue = /^\d+$/.test(filters.investment) ? filters.investment : '';

  const fetchPage = useCallback(async (page) => {
    const id = ++requestId.current;
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const res = await schemeAPI.listSchemes({
        q: debouncedQ,
        category: filters.category,
        state: filters.state,
        investment: investmentValue,
        sort: filters.sort,
        order: filters.sort === 'name' ? 'asc' : 'desc',
        page,
        limit: PAGE_SIZE,
      });
      if (id !== requestId.current) return; // a newer request superseded this one
      const rows = (res?.data?.schemes || []).map(normalizeScheme);
      setSchemes((prev) => (page === 1 ? rows : [...prev, ...rows]));
      setPagination(res?.data?.pagination || null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err, 'Could not load schemes.'));
      if (page === 1) setSchemes([]);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedQ, filters.category, filters.state, filters.sort, investmentValue]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const hasFilters = filters.q || filters.category || filters.state || filters.investment || filters.sort !== 'name';
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setDebouncedQ('');
  };

  const total = pagination?.total ?? 0;
  const canLoadMore = pagination && pagination.page < pagination.totalPages;

  if (selected) {
    return (
      <div className="discover-page">
        <SchemeDetails scheme={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="discover-page">
      <header className="discover-header">
        <button type="button" className="discover-back" onClick={onBack}>← Home</button>
        <div>
          <h1>Browse Schemes</h1>
          <p className="discover-subtitle">Search and filter every scheme in the database.</p>
        </div>
      </header>

      <section className="discover-filters" aria-label="Filters">
        <label className="filter-field filter-search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Scheme name or keyword, e.g. loan, women, food"
            value={filters.q}
            onChange={setFilter('q')}
            maxLength={100}
          />
        </label>

        <label className="filter-field">
          <span>Business type</span>
          <select value={filters.category} onChange={setFilter('category')}>
            <option value="">All types</option>
            {options.categories.map((c) => <option key={c} value={c}>{labelFor(c)}</option>)}
          </select>
        </label>

        <label className="filter-field">
          <span>State</span>
          <select value={filters.state} onChange={setFilter('state')}>
            <option value="">All states</option>
            {options.locations.map((l) => <option key={l} value={l}>{labelFor(l)}</option>)}
          </select>
        </label>

        <label className="filter-field">
          <span>Your project cost (₹)</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 500000"
            value={filters.investment}
            onChange={(e) => setFilters((f) => ({ ...f, investment: e.target.value.replace(/[^\d]/g, '').slice(0, 12) }))}
          />
        </label>

        <label className="filter-field">
          <span>Sort by</span>
          <select value={filters.sort} onChange={setFilter('sort')}>
            {Object.entries(SORT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <div className="filter-actions">
          <button type="button" className="clear-filters-btn" onClick={clearFilters} disabled={!hasFilters}>
            Clear filters
          </button>
        </div>
      </section>

      <p className="discover-count" aria-live="polite">
        {loading ? 'Loading…' : error ? '' : `${total} scheme${total === 1 ? '' : 's'} found`}
        {filters.state && !loading && !error && <span className="count-note"> (includes all-India schemes)</span>}
      </p>

      {error && (
        <div className="discover-state discover-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => fetchPage(1)}>Retry</button>
        </div>
      )}

      {!loading && !error && schemes.length === 0 && (
        <div className="discover-state">
          <p>No schemes match these filters.</p>
          {hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}
        </div>
      )}

      {loading && !error && (
        <div className="discover-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="discover-card skeleton" />)}
        </div>
      )}

      {!loading && schemes.length > 0 && (
        <div className="discover-grid">
          {schemes.map((s) => (
            <article key={s.id} className="discover-card">
              <SaveButton schemeId={s.id} className="card-corner" />
              <div className="discover-tags">
                <span className="tag tag-location">{labelFor(s.location) || 'All India'}</span>
                {s.business_category && s.business_category !== 'any' && (
                  <span className="tag">{labelFor(s.business_category)}</span>
                )}
              </div>
              <h3 className="discover-card-title">{s.name}</h3>
              <p className="discover-card-desc">{s.description || 'No description available.'}</p>
              <dl className="discover-facts">
                {s.benefits?.subsidy_percent !== undefined && (
                  <div><dt>Subsidy</dt><dd>{s.benefits.subsidy_percent}%</dd></div>
                )}
                {s.benefits?.max_subsidy !== undefined && (
                  <div><dt>Max support</dt><dd>{formatRupees(s.benefits.max_subsidy)}</dd></div>
                )}
                {s.benefits?.loan_amount !== undefined && s.benefits?.max_subsidy === undefined && (
                  <div><dt>Loan up to</dt><dd>{formatRupees(s.benefits.loan_amount)}</dd></div>
                )}
                {s.max_investment !== null && s.max_investment !== undefined && (
                  <div><dt>Project up to</dt><dd>{formatRupees(s.max_investment)}</dd></div>
                )}
              </dl>
              <button type="button" className="discover-details-btn" onClick={() => setSelected(s)}>
                View details →
              </button>
            </article>
          ))}
        </div>
      )}

      {canLoadMore && !loading && (
        <div className="discover-more">
          <button type="button" onClick={() => fetchPage(pagination.page + 1)} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Load more (${total - schemes.length} left)`}
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscoverSchemes;
