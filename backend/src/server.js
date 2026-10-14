
require('dotenv').config();
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is missing from backend/.env');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const sprintRoutes = require('./routes/sprints');
const taskRoutes = require('./routes/tasks');
const timeLogRoutes = require('./routes/timelogs');

const {
  notFoundHandler,
  errorHandler
} = require('./errorHandlers');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({
      status: 'ok',
      database: 'connected'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 'error',
      message: 'Database connection failed'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', sprintRoutes);
app.use('/api', taskRoutes);
app.use('/api', timeLogRoutes);

// Handle unknown routes and errors
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`TaskFlow API running on port ${PORT}`);
});
