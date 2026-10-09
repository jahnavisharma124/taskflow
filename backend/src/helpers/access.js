const pool = require('../db');

// Looks up a project and works out what this user may do with it.
// Returns null if the project doesn't exist.
async function getProjectAccess(user, projectId) {
  const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
  const project = rows[0];
  if (!project) return null;

  const isAdmin = user.role === 'admin';
  const isOwner = project.owner_id === user.id;

  let isMember = false;
  if (!isAdmin && !isOwner) {
    const [m] = await pool.query(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, user.id]
    );
    isMember = m.length > 0;
  }

  return {
    project,
    canView: isAdmin || isOwner || isMember, // see project, create/edit tasks
    canManage: isAdmin || isOwner,           // edit project, sprints, members, delete
  };
}

module.exports = { getProjectAccess };
