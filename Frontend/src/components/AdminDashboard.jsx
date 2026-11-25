import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { schemeAPI } from '../services/api';
import { useLanguage, LanguageToggle } from '../context/LanguageContext';
import { formatRupees, labelFor, normalizeScheme, errorMessage } from '../utils/format';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';

const EMPTY_FORM = {
  id: null,
  name: '',
  description: '',
  business_category: 'any',
  location: 'all_india',
  max_investment: '',
  subsidy_percent: '',
  max_subsidy: '',
  loan_amount: '',
  min_age: '',
  max_age: '',
  beneficiary_categories: '',
  official_source: '',
  verified: false,
};

function toFormState(scheme) {
  const s = normalizeScheme(scheme);
  const benefits = s.benefits && typeof s.benefits === 'object' && !Array.isArray(s.benefits) ? s.benefits : {};
  const rules = s.rules && typeof s.rules === 'object' ? s.rules : {};
  const bc = Array.isArray(s.beneficiary_categories) ? s.beneficiary_categories.join(', ') : '';
  return {
    id: s.id,
    name: s.name || '',
    description: s.description || '',
    business_category: s.business_category || 'any',
    location: s.location || 'all_india',
    max_investment: s.max_investment ?? '',
    subsidy_percent: benefits.subsidy_percent ?? '',
    max_subsidy: benefits.max_subsidy ?? '',
    loan_amount: benefits.loan_amount ?? '',
    min_age: rules.min_age ?? '',
    max_age: rules.max_age ?? '',
    beneficiary_categories: bc,
    official_source: s.official_source || '',
    verified: Boolean(s.verified),
  };
}

function toPayload(form) {
  const benefits = {};
  if (form.subsidy_percent !== '') benefits.subsidy_percent = Number(form.subsidy_percent);
  if (form.max_subsidy !== '') benefits.max_subsidy = Number(form.max_subsidy);
  if (form.loan_amount !== '') benefits.loan_amount = Number(form.loan_amount);

  const rules = {};
  if (form.min_age !== '') rules.min_age = Number(form.min_age);
  if (form.max_age !== '') rules.max_age = Number(form.max_age);

  const beneficiary_categories = form.beneficiary_categories
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    business_category: form.business_category.trim() || 'any',
    location: form.location.trim() || 'all_india',
    max_investment: form.max_investment === '' ? null : Number(form.max_investment),
    benefits,
    rules,
    beneficiary_categories,
    official_source: form.official_source.trim() || null,
    verified: Boolean(form.verified),
  };
}

function AdminDashboard({ onBack, onDashboard }) {
  const { t } = useLanguage();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadSchemes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const first = await schemeAPI.listSchemes({ page: 1, limit: 50, sort: 'name', order: 'asc' });
      const all = [...(first?.data?.schemes || [])];
      const totalPages = first?.data?.pagination?.totalPages || 1;
      for (let page = 2; page <= totalPages; page += 1) {
        const next = await schemeAPI.listSchemes({ page, limit: 50, sort: 'name', order: 'asc' });
        all.push(...(next?.data?.schemes || []));
      }
      setSchemes(all.map(normalizeScheme));
    } catch (err) {
      setError(errorMessage(err, 'Failed to load schemes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchemes();
  }, [loadSchemes]);

  const stats = useMemo(() => {
    const verified = schemes.filter((s) => s.verified).length;
    return {
      total: schemes.length,
      verified,
      unverified: schemes.length - verified,
    };
  }, [schemes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schemes.filter((s) => {
      if (verifiedFilter === 'verified' && !s.verified) return false;
      if (verifiedFilter === 'unverified' && s.verified) return false;
      if (q && !(s.name || '').toLowerCase().includes(q) && !(s.description || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [schemes, search, verifiedFilter]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
    setNotice(null);
    setError(null);
  };

  const openEdit = (scheme) => {
    setForm(toFormState(scheme));
    setShowForm(true);
    setNotice(null);
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Scheme name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = toPayload(form);
      if (form.id) {
        await schemeAPI.updateScheme(form.id, payload);
        setNotice(`Updated "${payload.name}".`);
      } else {
        await schemeAPI.createScheme(payload);
        setNotice(`Created "${payload.name}".`);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      await loadSchemes();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save scheme.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVerify = async (scheme) => {
    setError(null);
    setNotice(null);
    try {
      await schemeAPI.verifyScheme(scheme.id, {
        verified: !scheme.verified,
        official_source: scheme.official_source || null,
      });
      setNotice(`"${scheme.name}" marked as ${!scheme.verified ? 'verified' : 'unverified'}.`);
      await loadSchemes();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update verification status.'));
    }
  };

  const handleDelete = async (scheme) => {
    if (!window.confirm(`Delete "${scheme.name}"? This cannot be undone.`)) return;
    setError(null);
    setNotice(null);
    try {
      await schemeAPI.deleteScheme(scheme.id);
      setNotice(`Deleted "${scheme.name}".`);
      await loadSchemes();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete scheme.'));
    }
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <button type="button" className="dashboard-back" onClick={onBack}>
          {t('dashHome')}
        </button>
        <div style={{ flex: 1 }}>
          <h1>{t('adminTitle')}</h1>
          <p className="dashboard-subtitle">{t('adminSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <LanguageToggle />
          {onDashboard && (
            <button type="button" className="dashboard-back" onClick={onDashboard}>
              {t('navDashboard')}
            </button>
          )}
        </div>
      </header>

      <section className="dashboard-stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.total}</span>
          <span className="dashboard-stat-label">{t('adminTotal')}</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.verified}</span>
          <span className="dashboard-stat-label">{t('adminVerified')}</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.unverified}</span>
          <span className="dashboard-stat-label">{t('adminUnverified')}</span>
        </div>
      </section>

      {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}
      {notice && <div className="admin-alert admin-alert-success" role="status">{notice}</div>}

      <div className="admin-toolbar">
        <div className="admin-filters">
          <input
            type="search"
            className="admin-input admin-search"
            placeholder={t('adminSearchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="admin-select"
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            aria-label="Filter by verification status"
          >
            <option value="all">{t('adminFilterAll')}</option>
            <option value="verified">{t('adminFilterVerified')}</option>
            <option value="unverified">{t('adminFilterUnverified')}</option>
          </select>
        </div>
        <button type="button" className="admin-btn-primary" onClick={openCreate}>
          {t('adminAddScheme')}
        </button>
      </div>

      {showForm && (
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>{form.id ? t('adminEditScheme') : t('adminAddScheme')}</h2>
          <form onSubmit={handleSave}>
            <div className="admin-form-grid">
              <div className="admin-field admin-field-full">
                <label>Scheme Name *</label>
                <input
                  className="admin-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="admin-field admin-field-full">
                <label>Description</label>
                <textarea
                  className="admin-textarea"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="admin-field">
                <label>Business Category</label>
                <input
                  className="admin-input"
                  placeholder="e.g. manufacturing, service, any"
                  value={form.business_category}
                  onChange={(e) => setForm({ ...form, business_category: e.target.value })}
                />
              </div>

              <div className="admin-field">
                <label>Location / State</label>
                <input
                  className="admin-input"
                  placeholder="e.g. all_india, tamil_nadu"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div className="admin-field">
                <label>Max Investment (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.max_investment}
                  onChange={(e) => setForm({ ...form, max_investment: e.target.value })}
                />
              </div>

              <div className="admin-field">
                <label>Subsidy %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="admin-input"
                  value={form.subsidy_percent}
                  onChange={(e) => setForm({ ...form, subsidy_percent: e.target.value })}
                />
              </div>

              <div className="admin-field">
                <label>Max Subsidy (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.max_subsidy}
                  onChange={(e) => setForm({ ...form, max_subsidy: e.target.value })}
                />
              </div>

              <div className="admin-field">
                <label>Loan Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.loan_amount}
                  onChange={(e) => setForm({ ...form, loan_amount: e.target.value })}
                />
              </div>

              <div className="admin-field">
                <label>Min Age</label>
                <input
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.min_age}
                  onChange={(e) => setForm({ ...form, min_age: e.target.value })}
                />
              </div>

              <div className="admin-field">
                <label>Max Age</label>
                <input
                  type="number"
                  min="0"
                  className="admin-input"
                  value={form.max_age}
                  onChange={(e) => setForm({ ...form, max_age: e.target.value })}
                />
              </div>

              <div className="admin-field admin-field-full">
                <label>Beneficiary Categories (comma-separated)</label>
                <input
                  className="admin-input"
                  placeholder="e.g. women, sc_st, pwd"
                  value={form.beneficiary_categories}
                  onChange={(e) => setForm({ ...form, beneficiary_categories: e.target.value })}
                />
              </div>

              <div className="admin-field admin-field-full">
                <label>{t('adminOfficialSource')}</label>
                <input
                  className="admin-input"
                  placeholder="https://..."
                  value={form.official_source}
                  onChange={(e) => setForm({ ...form, official_source: e.target.value })}
                />
              </div>

              <div className="admin-field admin-field-full">
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.verified}
                    onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                  />
                  <span>{t('adminVerifiedLabel')}</span>
                </label>
              </div>
            </div>

            <div className="admin-form-actions">
              <button type="button" className="dashboard-back" onClick={() => setShowForm(false)}>
                {t('adminCancelBtn')}
              </button>
              <button type="submit" className="admin-btn-primary" disabled={saving}>
                {saving ? '...' : t('adminSaveBtn')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-card">
        {loading ? (
          <p className="dashboard-muted">Loading schemes...</p>
        ) : filtered.length === 0 ? (
          <p className="dashboard-muted">No schemes match the current filter.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Max Investment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>
                      <strong>{s.name}</strong>
                      {s.official_source && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          <a href={s.official_source} target="_blank" rel="noreferrer">{s.official_source}</a>
                        </div>
                      )}
                    </td>
                    <td>{labelFor(s.business_category || 'any')}</td>
                    <td>{labelFor(s.location || 'all_india')}</td>
                    <td>{s.max_investment ? formatRupees(s.max_investment) : '–'}</td>
                    <td>
                      <span className={`admin-badge ${s.verified ? 'admin-badge-verified' : 'admin-badge-unverified'}`}>
                        {s.verified ? t('adminVerified') : t('adminUnverified')}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" className="admin-btn-sm" onClick={() => handleToggleVerify(s)}>
                          {s.verified ? t('adminUnverifyBtn') : t('adminVerifyBtn')}
                        </button>
                        <button type="button" className="admin-btn-sm" onClick={() => openEdit(s)}>
                          {t('adminEditBtn')}
                        </button>
                        <button type="button" className="admin-btn-sm admin-btn-danger" onClick={() => handleDelete(s)}>
                          {t('adminDeleteBtn')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminDashboard;
