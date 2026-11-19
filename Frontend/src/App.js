import React, { useState, useEffect, useCallback } from 'react';
import HomePage from './Home/Homepage.jsx';
import SignIn from './components/SignIn.jsx';
import SignUp from './components/SignUp.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import RecommendationForm from './components/RecommendationForm.jsx';
import RecommendedSchemes from './components/RecommendedSchemes.jsx';
import DiscoverSchemes from './components/DiscoverSchemes.jsx';
import { SavedSchemesProvider, useSavedSchemes } from './context/SavedSchemesContext';
import './styles/SaveButton.css';
import { authAPI } from './services/api';
import './styles/App.css';

// Shows save/unsave failures (after the optimistic change was rolled back).
function SavedErrorToast() {
  const { error, clearError } = useSavedSchemes();
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(clearError, 5000);
    return () => clearTimeout(t);
  }, [error, clearError]);
  if (!error) return null;
  return (
    <div className="saved-toast" role="alert">
      <span>{error}</span>
      <button type="button" onClick={clearError}>OK</button>
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [browseQuery, setBrowseQuery] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [rankedBy, setRankedBy] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      let parsed = null;
      try {
        parsed = JSON.parse(storedUser);
      } catch {
        parsed = null;
      }
      setIsLoggedIn(true);
      setUser(parsed);

      // Confirm the stored session with the server and refresh the user details.
      // An expired/invalid token triggers the 401 interceptor ('auth:expired').
      authAPI.getCurrentUser()
        .then((res) => {
          const fresh = res?.data?.user;
          if (fresh) {
            const { id, email, name, phone } = fresh;
            const slim = { id, email, name, phone };
            localStorage.setItem('user', JSON.stringify(slim));
            setUser(slim);
          }
        })
        .catch((err) => {
          // 404 = account deleted: treat like an expired session
          if (err?.response?.status === 404) {
            authAPI.logout();
            setIsLoggedIn(false);
            setUser(null);
          }
        });
    }
  }, []);

  // API client fires this when a token is rejected (expired/invalid)
  useEffect(() => {
    const onExpired = () => {
      setIsLoggedIn(false);
      setUser(null);
      setRecommendations([]);
      setCurrentPage('signin');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const handleShowRecommendation = () => {
    if (!isLoggedIn) {
      setCurrentPage('signin');
      return;
    }
    
    setShowRecommendationForm(true);
    setTimeout(() => {
      const element = document.getElementById('recommendation');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    setCurrentPage('home');
  };

  const handleSignupSuccess = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    setCurrentPage('home');
  };

  const handleLogout = () => {
    authAPI.logout();
    setIsLoggedIn(false);
    setUser(null);
    setCurrentPage('home');
  };

  const handleNavigate = useCallback((page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  }, []);

  const requireLogin = useCallback(() => handleNavigate('signin'), [handleNavigate]);

  const handleBrowse = (q = '') => {
    setBrowseQuery(q);
    handleNavigate('discover');
  };


  return (
    <SavedSchemesProvider isLoggedIn={isLoggedIn} onRequireLogin={requireLogin}>
    <div className="App">
      {currentPage === 'home' && (
        <>
          <HomePage 
            onFindSchemes={handleShowRecommendation}
            isLoggedIn={isLoggedIn}
            user={user}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onBrowse={handleBrowse}
          />

          {showRecommendationForm && (
            <section id="recommendation" className="recommendation-section">
              <div className="recommendation-container">
                <div className="recommendation-header">
                  <h2>Find Schemes Tailored For You</h2>
                  <p>Answer a few simple questions about your business, and we'll recommend the best schemes for you</p>
                </div>

                <div className="recommendation-content">
                  <RecommendationForm
                    onRecommendations={(list, meta) => {
                      setRecommendations(list);
                      setRankedBy(meta?.ranked_by || null);
                    }}
                    onLoading={setIsLoading}
                  />
                  <RecommendedSchemes schemes={recommendations} isLoading={isLoading} rankedBy={rankedBy} />
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {currentPage === 'discover' && (
        <DiscoverSchemes
          key={browseQuery}
          initialQuery={browseQuery}
          onBack={() => handleNavigate('home')}
        />
      )}

      {currentPage === 'signin' && (
        <SignIn 
          onLoginSuccess={handleLoginSuccess}
          onNavigate={handleNavigate}
        />
      )}

      {currentPage === 'signup' && (
        <SignUp 
          onSignupSuccess={handleSignupSuccess}
          onNavigate={handleNavigate}
        />
      )}

      {currentPage === 'forgot-password' && (
        <ForgotPassword 
          onNavigate={handleNavigate}
        />
      )}
      <SavedErrorToast />
    </div>
    </SavedSchemesProvider>
  );
}

export default App;
