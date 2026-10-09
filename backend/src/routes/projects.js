const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { getProjectAccess } = require('../helpers/access');

const router = express.Router();
router.use(authenticate);

// POST /api/projects  (admin, manager)
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Project name is required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
      [name.trim(), description || null, req.user.id]
    );
    // The creator is automatically a member
    await conn.query('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)', [
      result.insertId,
      req.user.id,
    ]);
    await conn.commit();
    res.status(201).json({ id: result.insertId, name: name.trim(), description: description || null });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// GET /api/projects  (admin sees all, others see only their projects)
router.get('/', async (req, res) => {
  try {
    const base = `
      SELECT p.*, u.name AS owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id`;

    let rows;
    if (req.user.role === 'admin') {
      [rows] = await pool.query(`${base} ORDER BY p.created_at DESC`);
    } else {
      [rows] = await pool.query(
        `${base}
         JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = ?
         ORDER BY p.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/projects/:id  (project + members)
router.get('/:id', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.id);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canView) return res.status(403).json({ message: 'You are not part of this project' });

    const [members] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role
       FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?`,
      [req.params.id]
    );
    res.json({ ...access.project, members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/projects/:id  (owner or admin)
router.patch('/:id', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.id);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canManage) return res.status(403).json({ message: 'Only the owner or an admin can edit this project' });

    const { name, description } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ message: 'Project name cannot be empty' });
    }

    await pool.query(
      'UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
      [name !== undefined ? String(name).trim() : null, description ?? null, req.params.id]
    );
    res.json({ message: 'Project updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/projects/:id  (owner or admin)
router.delete('/:id', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.id);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canManage) return res.status(403).json({ message: 'Only the owner or an admin can delete this project' });

    await pool.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/projects/:id/members  body: { user_id }
router.post('/:id/members', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.id);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canManage) return res.status(403).json({ message: 'Only the owner or an admin can add members' });

    const { user_id } = req.body;
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });

    await pool.query('INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [
      req.params.id,
      user_id,
    ]);
    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.id);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canManage) return res.status(403).json({ message: 'Only the owner or an admin can remove members' });

    if (Number(req.params.userId) === access.project.owner_id) {
      return res.status(400).json({ message: 'The project owner cannot be removed' });
    }

    await pool.query('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [
      req.params.id,
      req.params.userId,
    ]);
    // Unassign their tasks in this project
    await pool.query(
      'UPDATE tasks SET assignee_id = NULL WHERE project_id = ? AND assignee_id = ?',
      [req.params.id, req.params.userId]
    );
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
