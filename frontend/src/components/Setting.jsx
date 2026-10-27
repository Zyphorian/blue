// src/components/Setting.jsx
//
// The settings popup. The background-music player that used to live here has been
// removed (the tracks are gone too) - what remains is purely visual preferences.
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Setting.module.css';
import { loadPrefs, setPref } from '../utils/battleStorage.js';

function Setting({ isOpen, onClose }) {
  // Game animations: off means case battles and upgrades resolve instantly
  // instead of revealing round by round / spinning the wheel.
  const [animations, setAnimations] = useState(() => loadPrefs().animations);

  const handleAnimationsToggle = (enabled) => {
    setAnimations(enabled);
    setPref('animations', enabled);
  };

  // document.body can briefly be unavailable during a hot reload; skip rendering
  // rather than letting createPortal throw.
  if (!isOpen || typeof document === 'undefined' || !document.body) {
    return null;
  }

  // Rendered into <body>: the header's backdrop-filter turns it into the
  // containing block for position:fixed children, which cut this popup off.
  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <h2 className={styles.modalTitle}>Settings</h2>
        <div className={styles.settingsOptions}>
          <div className={styles.settingItem}>
            <label htmlFor="animationsToggle">Game animations</label>
            <input
              type="checkbox"
              id="animationsToggle"
              checked={animations}
              onChange={(e) => handleAnimationsToggle(e.target.checked)}
            />
          </div>

          <div className={styles.settingItem}>
            <label htmlFor="languageSelect">Language</label>
            <select id="languageSelect" defaultValue="en">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>

          <div className={styles.settingItem}>
            <label htmlFor="themeSelect">Theme</label>
            <select id="themeSelect" defaultValue="dark">
              <option value="dark">Dark</option>
              <option value="light">Light (Not Implemented)</option>
            </select>
          </div>
        </div>
        <p className={styles.settingHint}>
          Animations off resolves battles and upgrades instantly, and also silences
          their opening sounds.
        </p>
        <button className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}

export default Setting;
