import express from "express";
import { getKeys, getKeyById, createKey, updateKey, deleteKey } from "../controllers/keyController.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// General reads (staff, security, admin)
router.get("/", authenticateToken, getKeys);
router.get("/:keyId", authenticateToken, getKeyById);

// Admin writes
router.post("/", authenticateToken, isAdmin, createKey);
router.put("/:keyId", authenticateToken, isAdmin, updateKey);
router.delete("/:keyId", authenticateToken, isAdmin, deleteKey);

export default router;
