import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './DepositModal.module.css';
import { MAX_DEPOSIT } from '../utils/walletLimits.js';

// Quick amounts, so a large deposit does not need to be typed digit by digit.
const PRESETS = [100, 1000, 10000, 100000];

const formatAmount = (value) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function DepositModal({ isOpen, onClose, onDeposit, onReset }) {
  const [depositAmount, setDepositAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // document.body can briefly be unavailable during a hot reload; skip rendering
  // rather than letting createPortal throw.
  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setErrorMessage('Please enter a valid positive amount.');
      return;
    }
    if (amount > MAX_DEPOSIT) {
      setErrorMessage(`Maximum deposit amount is ${formatAmount(MAX_DEPOSIT)}.`);
      return;
    }

    setBusy(true);
    const ok = await onDeposit(amount); // Delegate to the wallet context
    setBusy(false);

    if (ok === false) {
      setErrorMessage('The deposit was rejected. Try a different amount.');
      return;
    }
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
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <h2 className={styles.modalTitle}>Add funds</h2>
        <p className={styles.modalDescription}>
          Simulated balance - no real money is involved. Max {formatAmount(MAX_DEPOSIT)} per deposit.
        </p>

        <div className={styles.presetRow}>
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.presetButton}
              onClick={() => {
                setDepositAmount(String(preset));
                setErrorMessage('');
              }}
            >
              {formatAmount(preset)}
            </button>
          ))}
          <button
            type="button"
            className={styles.presetButton}
            onClick={() => {
              setDepositAmount(String(MAX_DEPOSIT));
              setErrorMessage('');
            }}
          >
            Max
          </button>
        </div>

        <input
          type="number"
          value={depositAmount}
          onChange={(e) => {
            setDepositAmount(e.target.value);
            setErrorMessage('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleDeposit();
          }}
          className={styles.depositInput}
          placeholder="Amount"
          min="0.01"
          step="0.01"
        />
        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
        <div className={styles.modalButtons}>
          <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
          <button className={styles.depositButton} onClick={handleDeposit} disabled={busy}>
            {busy ? 'Adding…' : 'Deposit'}
          </button>
        </div>
        <button className={styles.resetButton} onClick={handleReset}>Reset Balance to $0</button>
      </div>
    </div>,
    document.body
  );
}

export default DepositModal;
