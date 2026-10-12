// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import "./App.css";

import HomePage from "./pages/HomePage.jsx";
import CaseOpeningPage from "./pages/CaseOpeningPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import CrashPage from "./pages/CrashPage.jsx";
import UpgraderPage from "./pages/UpgraderPage.jsx";
import CaseBattlePage from "./pages/CaseBattlePage.jsx";
import AuthPage from "./pages/AuthPage.jsx";

import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import { MusicProvider } from "./components/MusicPlayer.jsx";
import { WalletProvider } from "./context/WalletContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// 👇 This component gives access to useLocation
function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <>
      {!isLoginPage && <Header />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/open-case/:caseId" element={<CaseOpeningPage />} />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <ProfilePage />
            </PrivateRoute>
          }
        />
        <Route path="/crash" element={<CrashPage />} />
        <Route path="/upgrader" element={<UpgraderPage />} />
        <Route path="/case-battle" element={<CaseBattlePage />} />
        <Route path="/login" element={<AuthPage />} />
      </Routes>
      {!isLoginPage && <Footer />}
    </>
  );
}

function PrivateRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axios.get("http://localhost:5000/api/profile", {
          withCredentials: true,
        });
        setIsAuthenticated(true);
      } catch (err) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) return <div>Loading...</div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    // The boundary sits outside the providers on purpose: a crash inside
    // MusicProvider or WalletProvider used to blank the whole page, and this way
    // those are caught too and shown as a readable message.
    <ErrorBoundary>
      <Router>
        <MusicProvider>
          <WalletProvider>
            <AppContent /> {/* 👈 wrapped with location access */}
          </WalletProvider>
        </MusicProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
