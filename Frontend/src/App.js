import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import HomePage from './Home/Homepage.jsx';
import RecommendationPage from './pages/RecommendationPage.jsx';
import SignIn from './components/SignIn.jsx';
import SignUp from './components/SignUp.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import { authAPI } from './services/api';
import './styles/App.css';

function AppContent() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        setIsLoggedIn(true);
        setUser(JSON.parse(storedUser));
      } catch (e) {
        setIsLoggedIn(false);
        setUser(null);
      }
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    navigate('/');
  };

  const handleSignupSuccess = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    navigate('/');
  };

  const handleLogout = () => {
    authAPI.logout();
    setIsLoggedIn(false);
    setUser(null);
    navigate('/');
  };

  const handleNavigate = (page) => {
    if (page === 'home') navigate('/');
    else navigate('/' + page);
    window.scrollTo(0, 0);
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            isLoggedIn={isLoggedIn}
            user={user}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        }
      />
      <Route
        path="/recommend"
        element={
          <RecommendationPage
            isLoggedIn={isLoggedIn}
            user={user}
            onLogout={handleLogout}
          />
        }
      />
      <Route
        path="/signin"
        element={
          <SignIn
            onLoginSuccess={handleLoginSuccess}
            onNavigate={handleNavigate}
          />
        }
      />
      <Route
        path="/signup"
        element={
          <SignUp
            onSignupSuccess={handleSignupSuccess}
            onNavigate={handleNavigate}
          />
        }
      />
      <Route
        path="/forgot-password"
        element={
          <ForgotPassword
            onNavigate={handleNavigate}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <AppContent />
      </div>
    </BrowserRouter>
  );
}

export default App;
