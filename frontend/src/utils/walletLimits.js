// src/utils/walletLimits.js
//
// Shared limits for the simulated wallet. Kept out of WalletContext so that
// exporting a plain constant there does not break React's fast-refresh rule
// (a module may only export components).
//
// Everything is fiction: this is a case-opening simulator, no real money exists.
export const GUEST_STARTING_BALANCE = 10;

// The most a single deposit may add. Large on purpose - the economy is simulated.
export const MAX_DEPOSIT = 1000000;
