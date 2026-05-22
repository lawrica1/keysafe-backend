import express from "express";
import { createReport } from "../controllers/reportController.js";
import { authenticateToken, isStaffOrAdmin } from "../middleware/auth.js";

const router = express.Router();

// Only staff or admins can submit reports
router.post("/", authenticateToken, isStaffOrAdmin, createReport);

export default router;
