// src/components/Setting.jsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Setting.module.css';
import { useMusic } from './MusicPlayer.jsx'; // Import the custom hook
import { loadPrefs, setPref } from '../utils/battleStorage.js';

function Setting({ isOpen, onClose }) {
  // Use the music context to get music state and controls
  const { isPlaying, volume, togglePlayPause, nextMusic, previousMusic, stopMusic, handleVolumeChange } = useMusic();

  // Game animations: off means case battles and upgrades resolve instantly
  // instead of revealing round by round / spinning the wheel.
  const [animations, setAnimations] = useState(() => loadPrefs().animations);

  const handleAnimationsToggle = (enabled) => {
    setAnimations(enabled);
    setPref('animations', enabled);
  };

  // Removed state for sound effects toggle as per request
  // const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => {
  //   const saved = localStorage.getItem('soundEffectsEnabled');
  //   return saved !== null ? JSON.parse(saved) : true; // Default to true
  // });

  // Removed effect to save sound effects preference
  // useEffect(() => {
  //   localStorage.setItem('soundEffectsEnabled', JSON.stringify(soundEffectsEnabled));
  // }, [soundEffectsEnabled]);

  // Removed handler for sound effects toggle
  // const handleSoundEffectsToggle = () => {
  //   setSoundEffectsEnabled(prev => !prev);
  // };

  // document.body can briefly be unavailable during a hot reload; skip rendering
  // rather than letting createPortal throw.
  if (!isOpen || typeof document === 'undefined' || !document.body) {
    return null; // Don't render if not open
  }

  // Rendered into <body>: the header's backdrop-filter turns it into the
  // containing block for position:fixed children, which cut this popup off.
  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>Settings</h2>
        <div className={styles.settingsOptions}>
          {/* Removed Sound Effects option */}
          {/* <div className={styles.settingItem}>
            <label htmlFor="soundToggle">Sound Effects:</label>
            <input
              type="checkbox"
              id="soundToggle"
              checked={soundEffectsEnabled}
              onChange={handleSoundEffectsToggle}
            />
          </div> */}

          {/* Music Controls */}
          <div className={styles.settingItem}>
            <label>Background Music:</label>
            <div className={styles.musicControls}>
              <button onClick={previousMusic} className={styles.musicButton}>
                &#9664;&#9664; {/* Rewind/Previous icon */}
              </button>
              <button onClick={togglePlayPause} className={styles.musicButton}>
                {isPlaying ? '❚❚' : '▶'} {/* Play/Pause icon */}
              </button>
              <button onClick={nextMusic} className={styles.musicButton}>
                &#9654;&#9654; {/* Fast Forward/Next icon */}
              </button>
              <button onClick={stopMusic} className={styles.musicButton}>
                &#9724; {/* Stop icon */}
              </button>
            </div>
          </div>

          {/* Volume Control */}
          <div className={styles.settingItem}>
            <label htmlFor="volumeControl">Volume:</label>
            <input
              type="range"
              id="volumeControl"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className={styles.volumeSlider}
            />
          </div>

          <div className={styles.settingItem}>
            <label htmlFor="animationsToggle">Game animations:</label>
            <input
              type="checkbox"
              id="animationsToggle"
              checked={animations}
              onChange={(e) => handleAnimationsToggle(e.target.checked)}
            />
          </div>

          <div className={styles.settingItem}>
            <label htmlFor="languageSelect">Language:</label>
            <select id="languageSelect" defaultValue="en">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
          <div className={styles.settingItem}>
            <label htmlFor="themeSelect">Theme:</label>
            <select id="themeSelect" defaultValue="dark">
              <option value="dark">Dark</option>
              <option value="light">Light (Not Implemented)</option>
            </select>
          </div>
        </div>
        <button className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}

export default Setting;
