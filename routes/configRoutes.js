import express from "express";
import { getRssiThreshold, updateRssiThreshold } from "../controllers/configController.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// Only admin can get or update threshold settings
router.get("/rssi-threshold", authenticateToken, isAdmin, getRssiThreshold);
router.put("/rssi-threshold", authenticateToken, isAdmin, updateRssiThreshold);

export default router;
