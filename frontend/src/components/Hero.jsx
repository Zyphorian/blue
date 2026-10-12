// src/components/Hero.jsx
import React from 'react';
import styles from './Hero.module.css'; // Import the CSS module

function Hero() {
  return (
    <section className={styles.hero}> {/* Use className from CSS module */}
      {/* Replaced text with image */}
      <img src="/images/Blue gem case banner.png" alt="Blue Gem Case Banner" className={styles.heroImage} />
    </section>
  );
}

export default Hero;