import bcrypt from "bcrypt";
import db from "../db/index.js";

/**
 * List all users: GET /api/users (Admin only)
 */
export async function getUsers(req, res) {
  try {
    const result = await db.query(
      `SELECT user_id, full_name, email, role, created_at 
       FROM users 
       ORDER BY user_id ASC`
    );
    
    const formattedUsers = result.rows.map(row => ({
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at
    }));

    return res.json(formattedUsers);
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ error: "Internal server error listing users" });
  }
}

/**
 * Create user: POST /api/users (Admin only)
 */
export async function createUser(req, res) {
  const { fullName, email, role, password } = req.body;

  if (!fullName || !email || !role || !password) {
    return res.status(400).json({ error: "Missing required fields: fullName, email, role, password" });
  }

  if (!["admin", "staff", "security"].includes(role)) {
    return res.status(400).json({ error: "Role must be admin, staff, or security" });
  }

  try {
    // Check duplication
    const emailCheck = await db.query("SELECT user_id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, full_name, email, role, created_at`,
      [fullName, email.toLowerCase(), passwordHash, role]
    );

    const newUser = result.rows[0];
    return res.status(201).json({
      message: "User created successfully",
      user: {
        userId: newUser.user_id,
        fullName: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.created_at
      }
    });

  } catch (err) {
    console.error("Create user error:", err);
    return res.status(500).json({ error: "Internal server error creating user" });
  }
}

/**
 * Update user: PUT /api/users/:userId (Admin only)
 */
export async function updateUser(req, res) {
  const { userId } = req.params;
  const { fullName, email, role } = req.body;

  if (!fullName || !email || !role) {
    return res.status(400).json({ error: "Missing required fields: fullName, email, role" });
  }

  if (!["admin", "staff", "security"].includes(role)) {
    return res.status(400).json({ error: "Role must be admin, staff, or security" });
  }

  try {
    // Check if user exists
    const userCheck = await db.query("SELECT * FROM users WHERE user_id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: `User with ID '${userId}' not found` });
    }

    // Verify email duplication if changing email
    const existingEmail = await db.query(
      "SELECT user_id FROM users WHERE email = $1 AND user_id != $2",
      [email.toLowerCase(), userId]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: "Another user with this email already exists" });
    }

    await db.query(
      `UPDATE users 
       SET full_name = $1, email = $2, role = $3
       WHERE user_id = $4`,
      [fullName, email.toLowerCase(), role, userId]
    );

    return res.json({
      message: "User updated successfully",
      user: {
        userId: parseInt(userId, 10),
        fullName,
        email: email.toLowerCase(),
        role
      }
    });

  } catch (err) {
    console.error("Update user error:", err);
    return res.status(500).json({ error: "Internal server error updating user" });
  }
}

/**
 * Delete user: DELETE /api/users/:userId (Admin only)
 */
export async function deleteUser(req, res) {
  const { userId } = req.params;

  try {
    // Check if user exists
    const userCheck = await db.query("SELECT role FROM users WHERE user_id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: `User with ID '${userId}' not found` });
    }

    // Prevent admin deleting their own account
    if (parseInt(userId, 10) === req.user.userId) {
      return res.status(400).json({ error: "Cannot delete your own active administrator account" });
    }

    await db.query("DELETE FROM users WHERE user_id = $1", [userId]);

    return res.json({ message: `User with ID '${userId}' deleted successfully` });

  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ error: "Internal server error deleting user" });
  }
}

/**
 * Reset password: POST /api/users/:userId/reset-password (Admin only)
 */
export async function resetPassword(req, res) {
  const { userId } = req.params;

  try {
    const userCheck = await db.query("SELECT email FROM users WHERE user_id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: `User with ID '${userId}' not found` });
    }

    // Generate random temporary password
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let temporaryPassword = "";
    for (let i = 0; i < 10; i++) {
      temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(temporaryPassword, saltRounds);

    await db.query("UPDATE users SET password_hash = $1 WHERE user_id = $2", [newHash, userId]);

    return res.json({
      message: "Password reset completed successfully",
      temporaryPassword
    });

  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Internal server error resetting password" });
  }
}
