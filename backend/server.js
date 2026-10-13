import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import walletRoutes from "./routes/wallet.routes.js";

import { notFound, errorHandler } from "./middleware/errormiddleware.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Which frontends may call this API. Defaults to the local dev servers, and is
// set to the deployed site with CLIENT_ORIGIN (comma separated for several):
//   CLIENT_ORIGIN=https://zyphorian.github.io
// A wildcard is deliberately not used: credentials (the session cookie) require
// an exact origin.
const allowedOrigins = (
  process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:4173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header at all (curl, same-origin requests, uptime checks) is fine.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(cookieParser());

app.use('/uploads', express.static('uploads'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Routes
app.use("/api", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/wallet", walletRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});