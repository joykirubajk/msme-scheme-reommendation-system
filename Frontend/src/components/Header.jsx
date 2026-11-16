import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Profile from './Profile';
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
    </header>
  );
}

export default Header;
