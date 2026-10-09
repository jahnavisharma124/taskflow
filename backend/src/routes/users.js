const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users  (admin and manager only)
router.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(rows);
});

// PATCH /api/users/:id/role  (admin only)
router.patch('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'manager', 'member'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  res.json({ message: 'Role updated' });
});

module.exports = router;
