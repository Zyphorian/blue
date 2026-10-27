// src/components/GameModes.jsx
//
// The three game modes, given their own prominent row at the top of the home
// page. The header links to them too, but this is what makes them impossible to
// miss - each card states what the mode is and how it plays.
import React from "react";
import { Link } from "react-router-dom";
import styles from "./GameModes.module.css";

const MODES = [
  {
    to: "/case-battle",
    icon: "⚔️",
    name: "Case Battle",
    tag: "1v1 vs bot",
    blurb: "Both sides open the same cases. Independent drops, highest total takes it all.",
    accent: "battle",
  },
  {
    to: "/crash",
    icon: "🚀",
    name: "Crash",
    tag: "Multiplier",
    blurb: "The multiplier climbs until it busts. Cash out in time, or lose the bet.",
    accent: "crash",
  },
  {
    to: "/upgrader",
    icon: "⬆️",
    name: "Skin Upgrader",
    tag: "Trade up",
    blurb: "Stake skins for a chance at something better. The odds are shown up front.",
    accent: "upgrader",
  },
];

function GameModes() {
  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Game modes</h2>
        <p className={styles.subtitle}>Three ways to play — every price is simulated.</p>
      </div>

      <div className={styles.grid}>
        {MODES.map((mode) => (
          <Link key={mode.to} to={mode.to} className={`${styles.card} ${styles[mode.accent]}`}>
            <span className={styles.icon} aria-hidden="true">
              {mode.icon}
            </span>
            <span className={styles.name}>{mode.name}</span>
            <span className={styles.tag}>{mode.tag}</span>
            <span className={styles.blurb}>{mode.blurb}</span>
            <span className={styles.play}>Play now →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default GameModes;
