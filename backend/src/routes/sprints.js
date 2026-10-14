
const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { getProjectAccess } = require('../helpers/access');

const router = express.Router();

router.use(authenticate);

// Validate positive integer IDs in route parameters
router.param('projectId', (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      message: 'ID must be a positive integer'
    });
  }
  next();
});

router.param('id', (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      message: 'ID must be a positive integer'
    });
  }
  next();
});

// Validate optional dates in YYYY-MM-DD format
function validDate(value) {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

// Validate both dates and their order
function validDates(start, end) {
  if (!validDate(start) || !validDate(end)) {
    return false;
  }

  if (start && end && end < start) {
    return false;
  }

  return true;
}

// GET /api/projects/:projectId/sprints
router.get('/projects/:projectId/sprints', async (req, res) => {
  try {
    const access = await getProjectAccess(
      req.user,
      req.params.projectId
    );

    if (!access) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    if (!access.canView) {
      return res.status(403).json({
        message: 'You are not part of this project'
      });
    }

    const [rows] = await pool.query(
      `SELECT s.*,
         (SELECT COUNT(*) FROM tasks t
          WHERE t.sprint_id = s.id) AS task_count,
         (SELECT COUNT(*) FROM tasks t
          WHERE t.sprint_id = s.id
          AND t.status = 'done') AS done_count
       FROM sprints s
       WHERE s.project_id = ?
       ORDER BY s.start_date`,
      [req.params.projectId]
    );

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// POST /api/projects/:projectId/sprints
router.post('/projects/:projectId/sprints', async (req, res) => {
  try {
    const access = await getProjectAccess(
      req.user,
      req.params.projectId
    );

    if (!access) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    if (!access.canManage) {
      return res.status(403).json({
        message: 'Only the owner or an admin can create sprints'
      });
    }

    const { name, start_date, end_date } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Sprint name is required'
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        message: 'Sprint name must not exceed 100 characters'
      });
    }

    if (!validDate(start_date) || !validDate(end_date)) {
      return res.status(400).json({
        message: 'Dates must be valid dates in YYYY-MM-DD format'
      });
    }

    if (!validDates(start_date, end_date)) {
      return res.status(400).json({
        message: 'End date cannot be before start date'
      });
    }

    const cleanStart = start_date || null;
    const cleanEnd = end_date || null;

    const [result] = await pool.query(
      `INSERT INTO sprints
       (project_id, name, start_date, end_date)
       VALUES (?, ?, ?, ?)`,
      [
        req.params.projectId,
        name.trim(),
        cleanStart,
        cleanEnd
      ]
    );

    return res.status(201).json({
      id: result.insertId,
      name: name.trim(),
      start_date: cleanStart,
      end_date: cleanEnd
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// PATCH /api/sprints/:id
router.patch('/sprints/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM sprints WHERE id = ?',
      [req.params.id]
    );

    const sprint = rows[0];

    if (!sprint) {
      return res.status(404).json({
        message: 'Sprint not found'
      });
    }

    const access = await getProjectAccess(
      req.user,
      sprint.project_id
    );

    if (!access) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    if (!access.canManage) {
      return res.status(403).json({
        message: 'Only the owner or an admin can edit sprints'
      });
    }

    const name = req.body.name ?? sprint.name;
    const start = req.body.start_date ?? sprint.start_date;
    const end = req.body.end_date ?? sprint.end_date;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Sprint name cannot be empty'
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        message: 'Sprint name must not exceed 100 characters'
      });
    }

    if (!validDate(start) || !validDate(end)) {
      return res.status(400).json({
        message: 'Dates must be valid dates in YYYY-MM-DD format'
      });
    }

    if (!validDates(start, end)) {
      return res.status(400).json({
        message: 'End date cannot be before start date'
      });
    }

    await pool.query(
      `UPDATE sprints
       SET name = ?, start_date = ?, end_date = ?
       WHERE id = ?`,
      [
        name.trim(),
        start || null,
        end || null,
        req.params.id
      ]
    );

    return res.json({
      message: 'Sprint updated'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

// DELETE /api/sprints/:id
// Its tasks remain, but are no longer assigned to this sprint.
router.delete('/sprints/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM sprints WHERE id = ?',
      [req.params.id]
    );

    const sprint = rows[0];

    if (!sprint) {
      return res.status(404).json({
        message: 'Sprint not found'
      });
    }

    const access = await getProjectAccess(
      req.user,
      sprint.project_id
    );

    if (!access) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    if (!access.canManage) {
      return res.status(403).json({
        message: 'Only the owner or an admin can delete sprints'
      });
    }

    await pool.query(
      'DELETE FROM sprints WHERE id = ?',
      [req.params.id]
    );

    return res.json({
      message: 'Sprint deleted'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
});

module.exports = router;
