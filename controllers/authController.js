import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db/index.js";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_keysafe";

/**
 * Register User: POST /api/auth/register
 */
export async function register(req, res) {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "Missing fullName, email, or password" });
  }

  try {
    // Check if user already exists
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role) 
       VALUES ($1, $2, $3, 'staff') 
       RETURNING user_id, full_name, email, role`,
      [fullName, email.toLowerCase(), passwordHash]
    );

    const newUser = result.rows[0];
    return res.status(201).json({
      message: "Registration successful",
      user: {
        userId: newUser.user_id,
        fullName: newUser.full_name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Internal server error during registration" });
  }
}

/**
 * Login User: POST /api/auth/login
 */
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const userResult = await db.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = userResult.rows[0];

    // Check password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        fullName: user.full_name
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error during login" });
  }
}

/**
 * Get Profile Info: GET /api/user/me
 */
export async function getMe(req, res) {
  try {
    const userResult = await db.query(
      "SELECT user_id, full_name, email, role, created_at FROM users WHERE user_id = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const user = userResult.rows[0];
    return res.json({
      userId: user.user_id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error("Get profile error:", err);
    return res.status(500).json({ error: "Internal server error retrieving profile" });
  }
}

/**
 * Change Profile Password: PUT /api/user/me/password
 */
export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Missing oldPassword or newPassword" });
  }

  try {
    const userResult = await db.query("SELECT password_hash FROM users WHERE user_id = $1", [req.user.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = userResult.rows[0].password_hash;

    // Validate old password
    const match = await bcrypt.compare(oldPassword, passwordHash);
    if (!match) {
      return res.status(400).json({ error: "Incorrect old password" });
    }

    // Hash and update new password
    const saltRounds = 10;
    const newHash = await bcrypt.hash(newPassword, saltRounds);

    await db.query("UPDATE users SET password_hash = $1 WHERE user_id = $2", [newHash, req.user.userId]);

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Internal server error changing password" });
  }
}
