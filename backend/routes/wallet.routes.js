import express from "express";
import {
  getWallet,
  spendFromWallet,
  depositToWallet,
  resetWallet,
} from "../controllers/wallet.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getWallet);
router.post("/spend", protect, spendFromWallet);
router.post("/deposit", protect, depositToWallet);
router.post("/reset", protect, resetWallet);

export default router;