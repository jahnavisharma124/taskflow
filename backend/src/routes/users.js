
const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Validate user IDs such as /api/users/1/role
router.param('id', (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      message: 'ID must be a positive integer'
    });
  }
  next();
});

// GET /api/users (admin and manager only)
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// PATCH /api/users/:id/role (admin only)
router.patch('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['admin', 'manager', 'member'].includes(role)) {
      return res.status(400).json({
        message: 'Invalid role'
      });
    }

    // Check whether the user exists first
    const [users] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    await pool.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, req.params.id]
    );

    return res.json({
      message: 'Role updated'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

module.exports = router;