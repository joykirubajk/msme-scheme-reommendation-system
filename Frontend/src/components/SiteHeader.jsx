import React, { useState } from 'react';
import Profile from './Profile.jsx';
import { useLanguage, LanguageToggle } from '../context/LanguageContext';
import '../styles/Homepage.css';

function SiteHeader({
  currentPage,
  isLoggedIn,
  user,
  onNavigate,
  onLogout,
  onBrowse,
  onFindSchemes,
}) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (onBrowse) onBrowse(searchQuery.trim());
  };

  const goSection = (hash) => {
    if (currentPage !== 'home') {
      onNavigate('home');
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="header">
      <div className="header-wrapper">
        <div className="logo-section">
          <button
            type="button"
            className="logo nav-link-btn"
            onClick={() => onNavigate('home')}
            style={{ padding: 0 }}
          >
            <img src="/msme-logo.jpg" alt="MSME Logo" className="logo-icon" />
            <h1 className="logo-text">{t('brand')}</h1>
          </button>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            className="search-input"
            type="search"
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="search-btn" type="submit" aria-label="Search">
            🔍
          </button>
        </form>

        <nav className="nav">
          <button
            type="button"
            className="nav-link nav-link-btn"
            onClick={() => onNavigate('home')}
          >
            {t('navHome')}
          </button>
          <button
            type="button"
            className="nav-link nav-link-btn"
            onClick={() => onBrowse && onBrowse('')}
          >
            {t('navBrowse')}
          </button>
          <button
            type="button"
            className="nav-link nav-link-btn"
            onClick={() => onFindSchemes && onFindSchemes()}
          >
            {t('dashFindSchemes')}
          </button>
          {isLoggedIn && (
            <button
              type="button"
              className="nav-link nav-link-btn"
              onClick={() => onNavigate('dashboard')}
            >
              {t('navDashboard')}
            </button>
          )}
          {isLoggedIn && user?.role === 'admin' && (
            <button
              type="button"
              className="nav-link nav-link-btn"
              onClick={() => onNavigate('admin')}
            >
              {t('navAdmin')}
            </button>
          )}
          <button
            type="button"
            className="nav-link nav-link-btn"
            onClick={() => goSection('#how-it-works')}
          >
            {t('navHowItWorks')}
          </button>
        </nav>

        <div className="header-actions">
          <LanguageToggle />

          {isLoggedIn && user ? (
            <div className="auth-section">
              <span className="user-greeting">{t('welcomeUser', { name: user.name })}</span>
              <Profile
                isLoggedIn={isLoggedIn}
                user={user}
                onNavigate={onNavigate}
                onLogout={onLogout}
              />
            </div>
          ) : (
            <Profile
              isLoggedIn={isLoggedIn}
              user={user}
              onNavigate={onNavigate}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
