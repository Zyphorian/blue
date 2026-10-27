import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
// The API location is configuration (VITE_API_URL), never a hardcoded localhost:
// the backend is not part of the static deployment.
import { API_BASE as API, hasBackend } from "../utils/apiBase.js";
import { GUEST_STARTING_BALANCE, MAX_DEPOSIT } from "../utils/walletLimits.js";
const WalletContext = createContext();

// This is a case-opening simulator, so people should be able to play - deposit
// fake money and open cases - without creating an account. A guest wallet lives
// in this browser (localStorage). Logging in switches to the server wallet, which
// is also what stores the skins you win, so an account is only needed to *keep*
// your inventory.
const GUEST_BALANCE_KEY = "guestWalletBalance";

const roundMoney = (value) => Math.round(value * 100) / 100;

const readGuestBalance = () => {
  try {
    const raw = localStorage.getItem(GUEST_BALANCE_KEY);
    if (raw === null) return GUEST_STARTING_BALANCE;
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return GUEST_STARTING_BALANCE;
    return roundMoney(parsed);
  } catch {
    // Private mode or storage disabled - just start fresh.
    return GUEST_STARTING_BALANCE;
  }
};

const writeGuestBalance = (value) => {
  try {
    localStorage.setItem(GUEST_BALANCE_KEY, String(roundMoney(value)));
  } catch (err) {
    console.warn("Could not save the guest balance:", err);
  }
};

export function WalletProvider({ children }) {
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Single source of truth for reading the balance. Call this after login or
  // logout so the header never shows a stale number.
  const refreshWallet = useCallback(async () => {
    // No backend configured (for example a static GitHub Pages build): go straight
    // to the local guest wallet instead of firing a request that cannot succeed.
    if (!hasBackend()) {
      const guestBalance = readGuestBalance();
      setWalletBalance(guestBalance);
      setIsGuest(true);
      setLoading(false);
      return guestBalance;
    }

    try {
      const res = await axios.get(`${API}/api/wallet`, { withCredentials: true });
      setWalletBalance(res.data.wallet || 0);
      setIsGuest(false);
      return res.data.wallet || 0;
    } catch {
      // Not logged in, or the API is down. Rather than showing an empty wallet,
      // fall back to the local guest wallet so the simulator still works.
      const guestBalance = readGuestBalance();
      setWalletBalance(guestBalance);
      setIsGuest(true);
      return guestBalance;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  // Returns true only when the spend succeeded. For a logged-in player the server
  // is the authority on the balance, so we send a delta rather than a computed
  // total. A guest spends from the local wallet.
  const spend = async (amount) => {
    if (isGuest) {
      const current = readGuestBalance();
      if (current < amount) {
        console.warn("Not enough balance.");
        return false;
      }
      const next = roundMoney(current - amount);
      writeGuestBalance(next);
      setWalletBalance(next);
      return true;
    }

    try {
      const res = await axios.post(
        `${API}/api/wallet/spend`,
        { amount },
        { withCredentials: true }
      );
      setWalletBalance(res.data.wallet);
      return true;
    } catch (err) {
      if (err.response?.status === 400) {
        console.warn("Not enough balance.");
        return false;
      }
      console.error("Spend failed:", err);
      return false;
    }
  };

  const deposit = async (amount) => {
    // Same validation the server applies, so a guest cannot end up with a
    // nonsense balance either.
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_DEPOSIT
    ) {
      console.warn("Invalid deposit amount.");
      return false;
    }

    if (isGuest) {
      const next = roundMoney(readGuestBalance() + amount);
      writeGuestBalance(next);
      setWalletBalance(next);
      return true;
    }

    try {
      const res = await axios.post(
        `${API}/api/wallet/deposit`,
        { amount },
        { withCredentials: true }
      );
      setWalletBalance(res.data.wallet);
      return true;
    } catch (err) {
      console.error("Deposit failed:", err);
      return false;
    }
  };

  const reset = async () => {
    if (isGuest) {
      writeGuestBalance(GUEST_STARTING_BALANCE);
      setWalletBalance(GUEST_STARTING_BALANCE);
      return;
    }

    try {
      const res = await axios.post(`${API}/api/wallet/reset`, {}, { withCredentials: true });
      setWalletBalance(res.data.wallet);
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  const value = {
    walletBalance,
    refreshWallet,
    spend,
    deposit,
    reset,
    setWalletBalance,
    loading,
    // True while playing without an account: the balance is local and wins are
    // not saved to a profile yet.
    isGuest,
  };

  return (
    <WalletContext.Provider value={value}>
      {/*
        Render the app immediately. Gating this on the wallet request meant that
        while the request was in flight (or retrying against a down API) React
        mounted nothing, so the whole page was blank white.
        `loading` is still exposed for components that want a loading state.
      */}
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
