import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Profile from './Profile';
import MyCollections from './MyCollections';
import { collectionAPI, authAPI } from '../services/api';
import '../styles/Homepage.css';

function Header({
  isLoggedIn,
  user,
  onLogout,
  onSearch,
  searchQuery: externalSearchQuery,
  onSearchChange,
  onNavigate
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery || '');
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const fetchSavedCount = useCallback(async () => {
    if (isLoggedIn || authAPI.isLoggedIn()) {
      try {
        const res = await collectionAPI.getSavedSchemes();
        if (res?.data?.schemes) {
          setSavedCount(res.data.schemes.length);
        }
      } catch (err) {
        // silent fail if unauthorized
      }
    } else {
      setSavedCount(0);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchSavedCount();
    const handleUpdate = () => fetchSavedCount();
    window.addEventListener('savedSchemesUpdated', handleUpdate);
    return () => window.removeEventListener('savedSchemesUpdated', handleUpdate);
  }, [fetchSavedCount]);

  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      navigate('/#schemes');
    }
  };

  const handleProfileNavigate = (page) => {
    if (onNavigate) {
      onNavigate(page);
    } else {
      if (page === 'signin') navigate('/signin');
      else if (page === 'signup') navigate('/signup');
      else if (page === 'home') navigate('/');
      else navigate('/' + page);
    }
  };

  const handleOpenSavedSchemes = () => {
    if (!isLoggedIn && !authAPI.isLoggedIn()) {
      navigate('/signin');
      return;
    }
    setShowSavedModal(true);
  };

  return (
    <header className="header">
      <div className="header-wrapper">
        <div className="logo-section">
          <Link to="/" className="logo">
            <img src="/msme logo.png" alt="MSME Logo" className="logo-icon" />
            <h1 className="logo-text">MSME Schemes</h1>
          </Link>
        </div>

        <form className="search-form" onSubmit={handleSearchSubmit}>
          <input
            className="search-input"
            type="search"
            placeholder="Search schemes by name..."
            value={searchQuery}
            onChange={handleInputChange}
          />
          <button className="search-btn" type="submit">
            🔍
          </button>
        </form>

        <nav className="nav">
          <Link className="nav-link" to="/">Home</Link>
          <a className="nav-link" href="/#schemes">Schemes</a>
          <Link className="nav-link" to="/recommend" style={{ fontWeight: '700', color: '#fef08a' }}>
            ✨ AI Recommendation
          </Link>
          <button
            type="button"
            className="nav-link saved-nav-link"
            onClick={handleOpenSavedSchemes}
            title="View your saved schemes"
          >
            📋 Saved Schemes
            {savedCount > 0 && (
              <span className="saved-badge-pill">{savedCount}</span>
            )}
          </button>
          <a className="nav-link" href="/#how-it-works">How It Works</a>
          <a className="nav-link" href="/#contact">Contact</a>
        </nav>

        {isLoggedIn && user ? (
          <div className="auth-section">
            <span className="user-greeting">Welcome, {user.name}</span>
            <Profile
              isLoggedIn={isLoggedIn}
              user={user}
              onNavigate={handleProfileNavigate}
              onLogout={onLogout}
            />
          </div>
        ) : (
          <Profile
            isLoggedIn={isLoggedIn}
            user={user}
            onNavigate={handleProfileNavigate}
            onLogout={onLogout}
          />
        )}
      </div>

      {/* Global Saved Schemes Modal */}
      {showSavedModal && (
        <MyCollections
          onClose={() => {
            setShowSavedModal(false);
            fetchSavedCount();
          }}
        />
      )}
    </header>
  );
}

export default Header;
