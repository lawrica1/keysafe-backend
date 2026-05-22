import express from "express";
import { getMe, changePassword } from "../controllers/authController.js";
import { 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  resetPassword 
} from "../controllers/userController.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// Current User profile routes (staff, security, admin)
router.get("/me", authenticateToken, getMe);
router.put("/me/password", authenticateToken, changePassword);

// Administrative User Management routes (admin only)
router.get("/", authenticateToken, isAdmin, getUsers);
router.post("/", authenticateToken, isAdmin, createUser);
router.put("/:userId", authenticateToken, isAdmin, updateUser);
router.delete("/:userId", authenticateToken, isAdmin, deleteUser);
router.post("/:userId/reset-password", authenticateToken, isAdmin, resetPassword);

export default router;
