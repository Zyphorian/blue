import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './DepositModal.module.css';

function DepositModal({ isOpen, onClose, onDeposit, onReset }) {
  const [depositAmount, setDepositAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // document.body can briefly be unavailable during a hot reload; skip rendering
  // rather than letting createPortal throw.
  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Please enter a valid positive amount.');
      return;
    }
    if (amount > 10000) {
      setErrorMessage('Maximum deposit amount is $10,000.');
      return;
    }

    onDeposit(amount);  // Delegate to Header
    setDepositAmount('');
    setErrorMessage('');
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  // Rendered into <body> on purpose. The header has backdrop-filter, which makes
  // it the containing block for position:fixed children - so inside the header
  // this overlay was only as tall as the header and the popup showed up cut off
  // at the top of the page.
  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>Deposit Money</h2>
        <p className={styles.modalDescription}>Enter the amount you wish to deposit.</p>
        <input
          type="number"
          value={depositAmount}
          onChange={(e) => {
            setDepositAmount(e.target.value);
            setErrorMessage('');
          }}
          className={styles.depositInput}
          min="0.01"
          step="0.01"
        />
        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
        <div className={styles.modalButtons}>
          <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
          <button className={styles.depositButton} onClick={handleDeposit}>Deposit</button>
        </div>
        <button className={styles.resetButton} onClick={handleReset}>Reset Balance to $0</button>
      </div>
    </div>,
    document.body
  );
}

export default DepositModal;
