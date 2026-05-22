import express from "express";
import { getLogs } from "../controllers/logController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Access is authenticated (further role checks implemented inside controller logic)
router.get("/", authenticateToken, getLogs);

export default router;
