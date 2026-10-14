
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required'
      });
    }

    // Validate name
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Name must be a non-empty string'
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        message: 'Name must not exceed 100 characters'
      });
    }

    // Validate email
    if (
      typeof email !== 'string' ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        message: 'Please provide a valid email address'
      });
    }

    // Validate password
    if (typeof password !== 'string') {
      return res.status(400).json({
        message: 'Password must be a string'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters'
      });
    }

    if (password.length > 72) {
      return res.status(400).json({
        message: 'Password must not exceed 72 characters'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check whether the email is already registered
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Email already registered'
      });
    }

    // Hash the password before saving it
    const passwordHash = await bcrypt.hash(password, 10);

    // Everyone registers as a member
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [cleanName, cleanEmail, passwordHash, 'member']
    );

    const user = {
      id: result.insertId,
      name: cleanName,
      email: cleanEmail,
      role: 'member'
    };

    return res.status(201).json({
      user,
      token: makeToken(user)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        message: 'Email and password must be strings'
      });
    }

    if (email.trim().length > 254 || password.length > 72) {
      return res.status(400).json({
        message: 'Invalid email or password format'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [cleanEmail]
    );

    const user = rows[0];

    // Use the same message for an unknown email or incorrect password
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: makeToken(user)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// GET /api/auth/me (protected)
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

module.exports = router;
