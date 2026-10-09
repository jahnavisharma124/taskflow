const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { getProjectAccess } = require('../helpers/access');

const router = express.Router();
router.use(authenticate);

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

// Checks that the assignee is a project member and the sprint belongs to the project.
// Returns an error message, or null if everything is fine.
async function checkRefs(projectId, assigneeId, sprintId) {
  if (assigneeId) {
    const [m] = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, assigneeId]
    );
    if (m.length === 0) return 'Assignee must be a member of this project';
  }
  if (sprintId) {
    const [s] = await pool.query('SELECT 1 FROM sprints WHERE id = ? AND project_id = ?', [
      sprintId,
      projectId,
    ]);
    if (s.length === 0) return 'Sprint does not belong to this project';
  }
  return null;
}

// GET /api/projects/:projectId/tasks?status=&assignee_id=&sprint_id=&priority=
router.get('/projects/:projectId/tasks', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.projectId);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canView) return res.status(403).json({ message: 'You are not part of this project' });

    let sql = `SELECT t.*, u.name AS assignee_name
               FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
               WHERE t.project_id = ?`;
    const params = [req.params.projectId];

    const { status, assignee_id, sprint_id, priority } = req.query;
    if (status) {
      if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status filter' });
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      if (!PRIORITIES.includes(priority)) return res.status(400).json({ message: 'Invalid priority filter' });
      sql += ' AND t.priority = ?';
      params.push(priority);
    }
    if (assignee_id) {
      sql += ' AND t.assignee_id = ?';
      params.push(assignee_id);
    }
    if (sprint_id) {
      sql += ' AND t.sprint_id = ?';
      params.push(sprint_id);
    }
    sql += ' ORDER BY t.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/projects/:projectId/tasks  (any project member)
router.post('/projects/:projectId/tasks', async (req, res) => {
  try {
    const access = await getProjectAccess(req.user, req.params.projectId);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canView) return res.status(403).json({ message: 'You are not part of this project' });

    const {
      title,
      description,
      status = 'todo',
      priority = 'medium',
      assignee_id = null,
      sprint_id = null,
      due_date = null,
    } = req.body;

    if (!title || !title.trim()) return res.status(400).json({ message: 'Task title is required' });
    if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ message: 'Invalid priority' });

    const refError = await checkRefs(req.params.projectId, assignee_id, sprint_id);
    if (refError) return res.status(400).json({ message: refError });

    const [result] = await pool.query(
      `INSERT INTO tasks (project_id, sprint_id, title, description, status, priority, assignee_id, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.projectId, sprint_id, title.trim(), description || null, status, priority, assignee_id, due_date]
    );
    res.status(201).json({ id: result.insertId, title: title.trim(), status, priority });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Loads a task and this user's access to its project
async function loadTask(req, res) {
  const [rows] = await pool.query(
    `SELECT t.*, u.name AS assignee_name
     FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ?`,
    [req.params.id]
  );
  const task = rows[0];
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return null;
  }
  const access = await getProjectAccess(req.user, task.project_id);
  if (!access.canView) {
    res.status(403).json({ message: 'You are not part of this project' });
    return null;
  }
  return { task, access };
}

// GET /api/tasks/:id
router.get('/tasks/:id', async (req, res) => {
  try {
    const loaded = await loadTask(req, res);
    if (!loaded) return;
    res.json(loaded.task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/tasks/:id  (any project member). Send only the fields you want to change.
router.patch('/tasks/:id', async (req, res) => {
  try {
    const loaded = await loadTask(req, res);
    if (!loaded) return;
    const { task } = loaded;

    const allowed = ['title', 'description', 'status', 'priority', 'assignee_id', 'sprint_id', 'due_date'];
    const fields = [];
    const values = [];

    for (const key of allowed) {
      if (key in req.body) {
        fields.push(`${key} = ?`);
        values.push(req.body[key] === '' ? null : req.body[key]);
      }
    }
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

    if ('title' in req.body && !String(req.body.title || '').trim()) {
      return res.status(400).json({ message: 'Task title cannot be empty' });
    }
    if ('status' in req.body && !STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    if ('priority' in req.body && !PRIORITIES.includes(req.body.priority)) {
      return res.status(400).json({ message: 'Invalid priority' });
    }

    const refError = await checkRefs(
      task.project_id,
      'assignee_id' in req.body ? req.body.assignee_id : null,
      'sprint_id' in req.body ? req.body.sprint_id : null
    );
    if (refError) return res.status(400).json({ message: refError });

    values.push(req.params.id);
    await pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Task updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/tasks/:id  (owner or admin)
router.delete('/tasks/:id', async (req, res) => {
  try {
    const loaded = await loadTask(req, res);
    if (!loaded) return;
    if (!loaded.access.canManage) {
      return res.status(403).json({ message: 'Only the owner or an admin can delete tasks' });
    }
    await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/tasks/:id/comments
router.get('/tasks/:id/comments', async (req, res) => {
  try {
    const loaded = await loadTask(req, res);
    if (!loaded) return;
    const [rows] = await pool.query(
      `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.name AS user_name
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ? ORDER BY c.created_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tasks/:id/comments  body: { body }
router.post('/tasks/:id/comments', async (req, res) => {
  try {
    const loaded = await loadTask(req, res);
    if (!loaded) return;
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ message: 'Comment cannot be empty' });

    const [result] = await pool.query('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)', [
      req.params.id,
      req.user.id,
      body.trim(),
    ]);
    res.status(201).json({ id: result.insertId, body: body.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
