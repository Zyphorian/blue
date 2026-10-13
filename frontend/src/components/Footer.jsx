// src/components/Footer.jsx
import React from 'react';
import styles from './Footer.module.css'; // Import the CSS module
import { asset } from "../utils/assetUrl.js";

function Footer() {
  const currentYear = new Date().getFullYear(); // Get the current year dynamically

  return (
    <footer className={styles.footer}>
      {/* Top Statistics Section */}
      <div className={styles.statisticsSection}>
        <div className={styles.statItem}>
          {/* Inlined Opened_Cases.svg and added a class for styling */}
          <svg className={`${styles.statIcon} ${styles.openedCasesIcon}`} width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"><path fillRule="evenodd" clipRule="evenodd" d="M22 5C21.4477 5 21 5.44772 21 6V7H19V6C19 5.44772 18.5523 5 18 5H14C13.4477 5 13 5.44772 13 6V7H11V6C11 5.44772 10.5523 5 10 5H7C6.44772 5 6 5.44772 6 6V7H5C4.44772 7 4 7.44772 4 8V11H28V8C28 7.44772 27.5523 7 27 7H26V6C26 5.44772 25.5523 5 25 5H22ZM28 13H4V24V25V26C4 26.5523 4.44772 27 5 27H8C8.55228 27 9 26.5523 9 26V25H23V26C23 26.5523 23.4477 27 24 27H27C27.5523 27 28 26.5523 28 26V25V24V13Z" fill="#88898F"></path></svg>
          <span className={`${styles.statNumber} ${styles.statCases}`}>5621683</span>
          <span className={styles.statLabel}>Opened Cases</span>
        </div>
        <div className={styles.statItem}>
          {/* Inlined arrow_up.svg and added a class for styling */}
          <svg className={`${styles.statIcon} ${styles.upgradeIcon}`} width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"><path d="M7 12.0227V8.90282C7 8.67478 7.11875 8.50375 7.35625 8.38973L16.5 4L25.6437 8.38973C25.8812 8.50375 26 8.67478 26 8.90282V12.0227C26 12.4218 25.5844 12.7069 25.1688 12.5358L16.5 8.37414L7.83125 12.5358C7.475 12.7069 7 12.4218 7 12.0227Z" fill="#88898F"></path><path d="M7 16.6117V19.7316C7 20.1307 7.475 20.4157 7.83125 20.2447L16.5 16.083L25.1688 20.2447C25.5844 20.4157 26 20.1307 26 19.7316V16.6117C26 16.3836 25.8812 16.2126 25.6437 16.0986L16.5 11.7089L7.35625 16.0986C7.11875 16.2126 7 16.3836 7 16.6117Z" fill="#88898F"></path><path d="M7 24.3164V27.4363C7 27.8353 7.475 28.1204 7.83125 27.9494L16.5 23.7877L25.1688 27.9494C25.5844 28.1204 26 27.8353 26 27.4363V24.3163C26 24.0883 25.8812 23.9173 25.6437 23.8033L16.5 19.4135L7.35625 23.8033C7.11875 23.9173 7 24.0883 7 24.3164Z" fill="#88898F"></path></svg>
          <span className={`${styles.statNumber} ${styles.statUpgrade}`}>1398884</span>
          <span className={styles.statLabel}>Upgrade</span>
        </div>
        <div className={styles.statItem}>
          {/* Keeping as <img> tag as no color change requested */}
          <img src={asset("/footer_images/users.svg")} alt="Users Icon" className={styles.statIcon} />
          <span className={`${styles.statNumber} ${styles.statUsers}`}>699663</span>
          <span className={styles.statLabel}>Users</span>
        </div>
        <div className={styles.statItem}>
          {/* Keeping as <img> tag as no color change requested */}
          <img src={asset("/footer_images/Battles.svg")} alt="Battles Icon" className={styles.statIcon} />
          <span className={`${styles.statNumber} ${styles.statBattles}`}>83460</span>
          <span className={styles.statLabel}>Battles</span>
        </div>
      </div>

      {/* Company Information / Copyright Section (Updated) */}
      <div className={styles.companyInfoSection}>
        {/* Removed: <p>The Website is operated by ERCBYTE LTD Company No. 16230898, 117 Mayfield Road, Dagenham, England, RM8 1XJ, Phone: +447418320067.</p> */}
        <p>&copy;{currentYear} <a href="#" className={styles.copyrightLink}>Blue Gem Case</a> All rights reserved</p>
      </div>

      {/* Navigation Links Section */}
      <nav className={styles.footerNav}>
        <a href="#">Terms of Service</a>
        <span className={styles.navSeparator}>|</span>
        <a href="#">Privacy Policy</a>
        <span className={styles.navSeparator}>|</span>
        <a href="#">Cookie Policy</a>
        <span className={styles.navSeparator}>|</span>
        <a href="#">AML Policy</a>
        <span className={styles.navSeparator}>|</span>
        <a href="#">Payment Policy</a>
        <span className={styles.navSeparator}>|</span>
        <a href="#">Provably Fair</a>
        <span className={styles.navSeparator}>|</span>
        <a href="#">Contact Us</a>
        <span className={styles.navSeparator}>|</span>
        <a href="#">Partnership</a>
        <span className={styles.navSeparator}>|</span>
        <a href="#">FAQ</a>
      </nav>

      {/* Payment Methods Section */}
      <div className={styles.paymentMethodsSection}>
        <img src={asset("/footer_images/Paysafecard.png")} alt="Paysafe Card Logo" className={styles.paymentLogo} />
        <img src={asset("/footer_images/PayPal.png")} alt="PayPal Logo" className={styles.paymentLogo} />
        <img src={asset("/footer_images/Google_Pay.png")} alt="Google Pay Logo" className={styles.paymentLogo} />
        <img src={asset("/footer_images/Mastercard.png")} alt="Mastercard Logo" className={styles.paymentLogo} />
        <img src={asset("/footer_images/Visa.png")} alt="Visa Logo" className={styles.paymentLogo} />
        <img src={asset("/footer_images/Bitcoin.png")} alt="Bitcoin Logo" className={styles.paymentLogo} />
        <img src={asset("/footer_images/Skinify.png")} alt="Skinify Logo" className={styles.paymentLogo} />
      </div>
    </footer>
  );
}

export default Footer;