import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

// Import Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import keyRoutes from "./routes/keyRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import configRoutes from "./routes/configRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with support for frontend clients
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

// Request Logging
app.use(morgan("dev"));

// Body Parsing
app.use(express.json());

// Uptime health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Mounting API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);  // Handles profile `/me` and `/me/password`
app.use("/api/users", userRoutes); // Handles admin user CRUD
app.use("/api/reports", reportRoutes);
app.use("/api/keys", keyRoutes);
app.use("/api/tracking-logs", logRoutes);
app.use("/api/config", configRoutes);

// Fallback for Page Not Found (404)
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} not found` });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error("Unhandled API Error:", err.stack);
  res.status(500).json({ 
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined 
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`KeySafe Tracker Backend listening at http://localhost:${PORT}`);
});
