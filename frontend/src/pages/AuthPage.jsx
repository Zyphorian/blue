import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiUser, FiMail, FiLock } from "react-icons/fi";
import styles from "./AuthForm.module.css";
import axios from "axios";
import { useWallet } from "../context/WalletContext.jsx";
import { API_BASE, hasBackend } from "../utils/apiBase.js";

export default function AuthPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { refreshWallet } = useWallet();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleForm = () => {
    setIsSignup(!isSignup);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isSignup ? "/api/register" : "/api/login";

    // Accounts live in the separate backend. Without it, say so plainly instead of
    // showing a generic network error - everything else works as a guest.
    if (!hasBackend()) {
      setError(
        "Accounts are unavailable here because the backend server is not connected. Close this window and play as a guest - your skins and balance are saved in this browser."
      );
      return;
    }

    try {
      await axios.post(`${API_BASE}${url}`, formData, {
        withCredentials: true, // This is essential for sending and receiving cookies
      });

      // The token is now in a secure cookie, so we can just navigate on success.
      // Pick up this account's balance before rendering the rest of the app.
      await refreshWallet();
      console.log("Login/Signup successful!");
      navigate("/");
    } catch (err) {
      console.error("Login/Signup error:", err);
      // More specific error handling
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setError(err.response.data.message || "An error occurred. Please try again.");
      } else if (err.request) {
        // The request was made but no response was received
        setError("Network error. Please ensure the backend is running.");
      } else {
        // Something happened in setting up the request that triggered an Error
        setError("An unexpected error occurred.");
      }
    }
  };

  return (
    <div className={styles.overlay} onClick={() => navigate("/")}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        <h2>{isSignup ? "Sign Up" : "Sign In"}</h2>
        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div className={styles.inputGroup}>
              <FiUser className={styles.icon} />
              <input
                type="text"
                name="name"
                placeholder="Name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          )}
          <div className={styles.inputGroup}>
            <FiMail className={styles.icon} />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <FiLock className={styles.icon} />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit">{isSignup ? "Sign Up" : "Sign In"}</button>
        </form>
        <p onClick={toggleForm} className={styles.toggle}>
          {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </p>
        <p onClick={() => navigate("/")} className={styles.cancel}>
          ← Back to Home
        </p>
      </div>
    </div>
  );
}