import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Header.module.css";
import DepositModal from "./DepositModal.jsx";
import Setting from "./Setting.jsx";
import InventoryPanel from "./InventoryPanel.jsx";
import axios from "axios";
import { useWallet } from "../context/WalletContext.jsx";
import { asset } from "../utils/assetUrl.js";
import { apiUrl, hasBackend } from "../utils/apiBase.js";

// Same key logCaseOpening.js writes to (see InventoryPanel.jsx).
const LOCAL_INVENTORY_KEY = "guestInventory";

function Header() {
  const { walletBalance, deposit, reset, refreshWallet } = useWallet();
  const [isDepositModalOpen, setIsDepositModal] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  // Badge count for the inventory trigger, kept in sync by InventoryPanel's
  // dsh-inventory-count event (and seeded from storage below).
  const [inventoryCount, setInventoryCount] = useState(0);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      // Static hosting has no backend, so there is no session to look up.
      if (!hasBackend()) {
        setUser(null);
        return;
      }
      try {
        const res = await axios.get(apiUrl("/api/profile"), {
          withCredentials: true,
        });
        setUser(res.data);
      } catch {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  // InventoryPanel reports the stored count on mount and after every change.
  // Reading it here as well covers the first paint, when the panel's own effect
  // may have dispatched before this listener was attached.
  useEffect(() => {
    const readStoredCount = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(LOCAL_INVENTORY_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        // A malformed value must never break the header.
        return 0;
      }
    };

    const handleInventoryCount = (event) => {
      const count = event.detail;
      setInventoryCount(typeof count === "number" ? count : 0);
    };

    setInventoryCount(readStoredCount());
    window.addEventListener("dsh-inventory-count", handleInventoryCount);
    return () => window.removeEventListener("dsh-inventory-count", handleInventoryCount);
  }, []);

  // Other screens (the battle menu, for example) can ask for a panel to open
  // without needing to reach into the header's state.
  useEffect(() => {
    const handleOpenPanel = (event) => {
      if (event.detail === "inventory") setIsInventoryOpen(true);
      if (event.detail === "settings") setIsSettingsModalOpen(true);
      if (event.detail === "wallet") setIsDepositModal(true);
    };
    window.addEventListener("dsh-open-panel", handleOpenPanel);
    return () => window.removeEventListener("dsh-open-panel", handleOpenPanel);
  }, []);

  const handleLogout = async () => {
    try {
      if (hasBackend()) {
        await axios.post(apiUrl("/api/logout"), {}, { withCredentials: true });
      }
      setUser(null);
      // Read the balance back from the API instead of inventing a number.
      await refreshWallet();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const formatDollar = (value) =>
    typeof value === "number"
      ? value.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : "$0.00";

  return (
    <header className={styles.header}>
      {/* Same UI structure */}
      <div className={styles.headerLeft}>
        <Link to="/" className={styles.homeLink}>
          <img src={asset("/icons/logo.png")} alt="Blue Gem Case logo" className={styles.logo} />
          <h1>Blue Gem Case</h1>
        </Link>
      </div>

      <nav className={styles.modeNav}>
        <Link to="/case-battle" className={styles.modeLink}>
          <span className={styles.modeIcon} aria-hidden="true">⚔️</span> Case Battle
        </Link>
        <Link to="/crash" className={styles.modeLink}>
          <span className={styles.modeIcon} aria-hidden="true">🚀</span> Crash
        </Link>
        <Link to="/upgrader" className={styles.modeLink}>
          <span className={styles.modeIcon} aria-hidden="true">⬆️</span> Upgrader
        </Link>
      </nav>

      <div className={styles.headerRight}>
        <nav className={styles.headerRightNav}>
          {user ? (
            <>
              <Link to="/profile" className={styles.navLink}>Profile</Link>
              <button onClick={handleLogout} className={`${styles.navLink} ${styles.logoutButton}`}>Logout</button>
            </>
          ) : (
            <Link to="/login" className={styles.navLink}>Login</Link>
          )}

          <div
            className={styles.walletContainer}
            onClick={() => setIsDepositModal(true)}
          >
            <img src={asset("/icons/wallet.svg")} alt="Wallet" className={styles.walletImage} />
            <span className={styles.walletBalance}>{formatDollar(walletBalance)}</span>
            <span className={styles.depositIndicator}>+</span>
          </div>

          {/* Temporary inventory of everything opened in this browser. */}
          <div
            className={styles.inventoryIconContainer}
            onClick={() => setIsInventoryOpen(true)}
          >
            <img src={asset("/icons/inventory.svg")} alt="Inventory" className={styles.inventoryIcon} />
            {inventoryCount > 0 && (
              <span className={styles.inventoryBadge}>
                {inventoryCount > 99 ? "99+" : inventoryCount}
              </span>
            )}
          </div>

          <div
            className={styles.settingsIconContainer}
            onClick={() => setIsSettingsModalOpen(true)}
          >
            <img src={asset("/icons/settings.svg")} alt="Settings" className={styles.settingsIcon} />
          </div>
        </nav>
      </div>

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModal(false)}
        onDeposit={deposit} // ✅ from context
        onReset={reset}     // ✅ from context
      />

      <Setting
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <InventoryPanel
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
      />
    </header>
  );
}

export default Header;
