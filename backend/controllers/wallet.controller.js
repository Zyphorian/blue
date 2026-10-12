import User from "../models/user.model.js";

const MAX_DEPOSIT = 10000;

// GET wallet balance
export const getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("wallet");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ wallet: user.wallet });
  } catch (err) {
    console.error("Error getting wallet:", err);
    res.status(500).json({ message: "Failed to get wallet" });
  }
};

// POST /api/wallet/spend  { amount }
// Spends a fixed amount. The client sends a delta, never a total, so it can
// never decide its own balance. The conditional update makes this atomic: if two
// requests race, only the ones that still have funds succeed.
export const spendFromWallet = async (req, res) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user._id, wallet: { $gte: amount } },
      { $inc: { wallet: -amount } },
      { new: true, projection: "wallet" }
    );

    if (!user) {
      // Either the user vanished, or the balance was too low.
      const exists = await User.exists({ _id: req.user._id });
      if (!exists) return res.status(404).json({ message: "User not found" });
      return res.status(400).json({ message: "Insufficient balance" });
    }

    res.status(200).json({ wallet: user.wallet });
  } catch (err) {
    console.error("Error spending from wallet:", err);
    res.status(500).json({ message: "Failed to spend from wallet" });
  }
};

// POST /api/wallet/deposit  { amount }
export const depositToWallet = async (req, res) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }
    if (amount > MAX_DEPOSIT) {
      return res.status(400).json({ message: `Maximum deposit is $${MAX_DEPOSIT}` });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { wallet: amount } },
      { new: true, projection: "wallet" }
    );

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ wallet: user.wallet });
  } catch (err) {
    console.error("Error depositing to wallet:", err);
    res.status(500).json({ message: "Failed to deposit to wallet" });
  }
};

// POST /api/wallet/reset -> back to the starting balance
export const resetWallet = async (req, res) => {
  try {
    const startingBalance = Number(process.env.STARTING_BALANCE ?? 10);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { wallet: startingBalance },
      { new: true, projection: "wallet" }
    );

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ wallet: user.wallet });
  } catch (err) {
    console.error("Error resetting wallet:", err);
    res.status(500).json({ message: "Failed to reset wallet" });
  }
};