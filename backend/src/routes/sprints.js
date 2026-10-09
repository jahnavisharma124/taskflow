const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { getProjectAccess } = require('../helpers/access');

const router = express.Router();
router.use(authenticate);

function validDates(start, end) {
  if (start && end && new Date(end) < new Date(start)) return false;
  return true;
}

// GET /api/projects/:projectId/sprints
router.get('/projects/:projectId/sprints', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.projectId);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canView) return res.status(403).json({ message: 'You are not part of this project' });

    const [rows] = await pool.query(
      `SELECT s.*,
         (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id) AS task_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.status = 'done') AS done_count
       FROM sprints s WHERE s.project_id = ? ORDER BY s.start_date`,
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/projects/:projectId/sprints  (owner or admin)
router.post('/projects/:projectId/sprints', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.projectId);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canManage) return res.status(403).json({ message: 'Only the owner or an admin can create sprints' });

    const { name, start_date, end_date } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Sprint name is required' });
    if (!validDates(start_date, end_date)) {
      return res.status(400).json({ message: 'End date cannot be before start date' });
    }

    const [result] = await pool.query(
      'INSERT INTO sprints (project_id, name, start_date, end_date) VALUES (?, ?, ?, ?)',
      [req.params.projectId, name.trim(), start_date || null, end_date || null]
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), start_date, end_date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/sprints/:id
router.patch('/sprints/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM sprints WHERE id = ?', [req.params.id]);
    const sprint = rows[0];
    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

    const access = await getProjectAccess(req.user, sprint.project_id);
    if (!access.canManage) return res.status(403).json({ message: 'Only the owner or an admin can edit sprints' });

    const name = req.body.name ?? sprint.name;
    const start = req.body.start_date ?? sprint.start_date;
    const end = req.body.end_date ?? sprint.end_date;
    if (!String(name).trim()) return res.status(400).json({ message: 'Sprint name cannot be empty' });
    if (!validDates(start, end)) return res.status(400).json({ message: 'End date cannot be before start date' });

    await pool.query('UPDATE sprints SET name = ?, start_date = ?, end_date = ? WHERE id = ?', [
      String(name).trim(),
      start,
      end,
      req.params.id,
    ]);
    res.json({ message: 'Sprint updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/sprints/:id  (its tasks stay, just unassigned from the sprint)
router.delete('/sprints/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM sprints WHERE id = ?', [req.params.id]);
    const sprint = rows[0];
    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

    const access = await getProjectAccess(req.user, sprint.project_id);
    if (!access.canManage) return res.status(403).json({ message: 'Only the owner or an admin can delete sprints' });

    await pool.query('DELETE FROM sprints WHERE id = ?', [req.params.id]);
    res.json({ message: 'Sprint deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
