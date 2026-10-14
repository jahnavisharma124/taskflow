const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { getProjectAccess } = require('../helpers/access');

const router = express.Router();
router.use(authenticate);

function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

// Loads a task and checks the user belongs to its project. Sends the error itself.
async function loadTask(req, res) {
  const [rows] = await pool.query('SELECT id, project_id FROM tasks WHERE id = ?', [req.params.id]);
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

// GET /api/tasks/:id/time-logs
router.get('/tasks/:id/time-logs', async (req, res) => {
  try {
    const loaded = await loadTask(req, res);
    if (!loaded) return;
    const [rows] = await pool.query(
      `SELECT tl.id, tl.hours, tl.log_date, tl.note, tl.user_id, u.name AS user_name
       FROM time_logs tl JOIN users u ON u.id = tl.user_id
       WHERE tl.task_id = ? ORDER BY tl.log_date DESC, tl.id DESC`,
      [req.params.id]
    );
    res.json(rows.map((r) => ({ ...r, hours: Number(r.hours) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/tasks/:id/time-logs  body: { hours, log_date, note }
router.post('/tasks/:id/time-logs', async (req, res) => {
  try {
    const loaded = await loadTask(req, res);
    if (!loaded) return;

    const hours = Math.round(Number(req.body.hours) * 100) / 100;
    const { log_date, note } = req.body;

    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      return res.status(400).json({ message: 'Hours must be more than 0 and at most 24' });
    }
    if (!isValidDate(log_date)) {
      return res.status(400).json({ message: 'Date must be in YYYY-MM-DD format' });
    }
    if (note && String(note).length > 255) {
      return res.status(400).json({ message: 'Note must be 255 characters or fewer' });
    }

    // A person cannot log more than 24 hours in one day across all tasks
    const [[day]] = await pool.query(
      'SELECT COALESCE(SUM(hours), 0) AS total FROM time_logs WHERE user_id = ? AND log_date = ?',
      [req.user.id, log_date]
    );
    if (Number(day.total) + hours > 24) {
      return res.status(400).json({ message: 'You cannot log more than 24 hours in one day' });
    }

    const [result] = await pool.query(
      'INSERT INTO time_logs (task_id, user_id, hours, log_date, note) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.id, hours, log_date, note ? String(note).trim() : null]
    );
    res.status(201).json({ id: result.insertId, hours, log_date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/time-logs/:id  (your own entry, or the project owner/admin)
router.delete('/time-logs/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT tl.id, tl.user_id, t.project_id
       FROM time_logs tl JOIN tasks t ON t.id = tl.task_id WHERE tl.id = ?`,
      [req.params.id]
    );
    const log = rows[0];
    if (!log) return res.status(404).json({ message: 'Time entry not found' });

    const access = await getProjectAccess(req.user, log.project_id);
    if (log.user_id !== req.user.id && !access.canManage) {
      return res.status(403).json({ message: 'You can only delete your own time entries' });
    }
    await pool.query('DELETE FROM time_logs WHERE id = ?', [req.params.id]);
    res.json({ message: 'Time entry deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/projects/:projectId/report  (any project member)
router.get('/projects/:projectId/report', async (req, res) => {
  try {
    const pid = req.params.projectId;
    const access = await getProjectAccess(req.user, pid);
    if (!access) return res.status(404).json({ message: 'Project not found' });
    if (!access.canView) return res.status(403).json({ message: 'You are not part of this project' });

    const [[totals]] = await pool.query(
      `SELECT COUNT(*) AS total_tasks,
              COALESCE(SUM(status = 'done'), 0) AS done_tasks,
              COALESCE(SUM(due_date < CURDATE() AND status <> 'done'), 0) AS overdue_tasks
       FROM tasks WHERE project_id = ?`,
      [pid]
    );
    const [[hoursRow]] = await pool.query(
      `SELECT COALESCE(SUM(tl.hours), 0) AS total_hours
       FROM time_logs tl JOIN tasks t ON t.id = tl.task_id WHERE t.project_id = ?`,
      [pid]
    );

    const [sprints] = await pool.query(
      `SELECT s.id, s.name, s.start_date, s.end_date,
              COUNT(t.id) AS task_count,
              COALESCE(SUM(t.status = 'done'), 0) AS done_count,
              (SELECT COALESCE(SUM(tl.hours), 0)
                 FROM time_logs tl JOIN tasks t2 ON t2.id = tl.task_id
                WHERE t2.sprint_id = s.id) AS hours
       FROM sprints s LEFT JOIN tasks t ON t.sprint_id = s.id
       WHERE s.project_id = ?
       GROUP BY s.id ORDER BY s.start_date`,
      [pid]
    );

    const [members] = await pool.query(
      `SELECT u.id, u.name,
              COALESCE(SUM(tl.hours), 0) AS hours,
              (SELECT COUNT(*) FROM tasks t3
                WHERE t3.project_id = pm.project_id AND t3.assignee_id = u.id AND t3.status <> 'done') AS open_tasks
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       LEFT JOIN tasks t ON t.project_id = pm.project_id
       LEFT JOIN time_logs tl ON tl.task_id = t.id AND tl.user_id = u.id
       WHERE pm.project_id = ?
       GROUP BY u.id, u.name, pm.project_id
       ORDER BY hours DESC`,
      [pid]
    );

    const [topTasks] = await pool.query(
      `SELECT t.id, t.title, t.status, COALESCE(SUM(tl.hours), 0) AS hours
       FROM tasks t LEFT JOIN time_logs tl ON tl.task_id = t.id
       WHERE t.project_id = ?
       GROUP BY t.id, t.title, t.status
       HAVING hours > 0
       ORDER BY hours DESC LIMIT 10`,
      [pid]
    );

    res.json({
      project: { id: access.project.id, name: access.project.name },
      totals: {
        total_tasks: Number(totals.total_tasks),
        done_tasks: Number(totals.done_tasks),
        overdue_tasks: Number(totals.overdue_tasks),
        total_hours: Number(hoursRow.total_hours),
      },
      sprints: sprints.map((s) => ({
        ...s,
        task_count: Number(s.task_count),
        done_count: Number(s.done_count),
        hours: Number(s.hours),
      })),
      members: members.map((m) => ({ ...m, hours: Number(m.hours), open_tasks: Number(m.open_tasks) })),
      top_tasks: topTasks.map((t) => ({ ...t, hours: Number(t.hours) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
