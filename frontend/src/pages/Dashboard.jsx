import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const canCreate = user.role === 'admin' || user.role === 'manager';

  async function loadProjects() {
    try {
      setProjects(await api('/projects'));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api('/projects', { method: 'POST', body: { name, description } });
      setName('');
      setDescription('');
      loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Projects</h1>
      {error && <div className="error">{error}</div>}

      {canCreate && (
        <form className="panel row-form" onSubmit={handleCreate}>
          <input placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="btn btn-primary">Create project</button>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : projects.length === 0 ? (
        <p className="muted">
          {canCreate
            ? 'No projects yet. Create your first one above.'
            : 'You are not part of any project yet. Ask a manager to add you.'}
        </p>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="card project-card">
              <h3>{p.name}</h3>
              <p className="muted">{p.description || 'No description'}</p>
              <div className="meta">
                <span>{p.task_count} tasks</span>
                <span>Owner: {p.owner_name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
