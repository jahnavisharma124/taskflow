require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const sprintRoutes = require('./routes/sprints');
const taskRoutes = require('./routes/tasks');
const timeLogRoutes = require('./routes/timelogs');
const { notFoundHandler, errorHandler } = require('./errorHandlers');

const app = express();
app.use(cors());
app.use(express.json());

// Health check: confirms server + database are working
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', sprintRoutes);   // /api/projects/:id/sprints and /api/sprints/:id
app.use('/api', taskRoutes);     // /api/projects/:id/tasks and /api/tasks/:id
app.use('/api', timeLogRoutes);  // /api/tasks/:id/time-logs, /api/time-logs/:id, /api/projects/:id/report
// Handle requests to routes that do not exist
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`TaskFlow API running on port ${PORT}`));
