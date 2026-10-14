import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

export default function ProjectBoard() {
  const { id } = useParams();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [sprintFilter, setSprintFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalTask, setModalTask] = useState(undefined); // undefined = closed, null = new task, object = edit
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [newSprint, setNewSprint] = useState({ name: '', start_date: '', end_date: '' });
  const [memberToAdd, setMemberToAdd] = useState('');

  const canManage = Boolean(project) && (user.role === 'admin' || project.owner_id === user.id);

  const load = useCallback(async () => {
    try {
      const [p, t, s] = await Promise.all([
        api(`/projects/${id}`),
        api(`/projects/${id}/tasks`),
        api(`/projects/${id}/sprints`),
      ]);
      setProject(p);
      setTasks(t);
      setSprints(s);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // The users list is only needed for the "add member" dropdown
  useEffect(() => {
    if (!canManage) return;
    api('/users').then(setAllUsers).catch(() => {});
  }, [canManage]);

  async function handleDrop(e, status) {
    e.preventDefault();
    setDragOverColumn(null);

    const taskId = Number(e.dataTransfer.getData('text/plain'));
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    // Update the screen immediately, then tell the server. Undo if it fails.
    const previous = tasks;
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await api(`/tasks/${taskId}`, { method: 'PATCH', body: { status } });
    } catch (err) {
      setTasks(previous);
      setError(err.message);
    }
  }

  async function handleAddSprint(e) {
    e.preventDefault();
    try {
      await api(`/projects/${id}/sprints`, {
        method: 'POST',
        body: {
          name: newSprint.name,
          start_date: newSprint.start_date || null,
          end_date: newSprint.end_date || null,
        },
      });
      setNewSprint({ name: '', start_date: '', end_date: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberToAdd) return;
    try {
      await api(`/projects/${id}/members`, { method: 'POST', body: { user_id: Number(memberToAdd) } });
      setMemberToAdd('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="muted">Loading...</p>;
  if (!project) return (
    <div>
      <div className="error">{error || 'Project not found'}</div>
      <Link to="/">Back to projects</Link>
    </div>
  );

  const visibleTasks = sprintFilter
    ? tasks.filter((t) => String(t.sprint_id) === sprintFilter)
    : tasks;
  const nonMembers = allUsers.filter((u) => !project.members.some((m) => m.id === u.id));

  return (
    <div>
      <Link to="/" className="muted">&larr; All projects</Link>
      <div className="board-header">
        <div>
          <h1>{project.name}</h1>
          <p className="muted">{project.description}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalTask(null)}>+ New task</button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <label className="inline">Sprint:
          <select value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)}>
            <option value="">All tasks</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.done_count}/{s.task_count} done)
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          Team: {project.members.map((m) => m.name).join(', ')}
        </span>
      </div>

      <div className="board">
        {COLUMNS.map((col) => {
          const colTasks = visibleTasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className={dragOverColumn === col.key ? 'column drag-over' : 'column'}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(col.key);
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <h3>{col.label} <span className="count">{colTasks.length}</span></h3>
              {colTasks.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => setModalTask(t)} />
              ))}
            </div>
          );
        })}
      </div>

      {canManage && (
        <div className="admin-panels">
          <form className="panel" onSubmit={handleAddSprint}>
            <h3>Add sprint</h3>
            <div className="row-form">
              <input placeholder="Sprint name" value={newSprint.name}
                onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })} required />
              <input type="date" value={newSprint.start_date}
                onChange={(e) => setNewSprint({ ...newSprint, start_date: e.target.value })} />
              <input type="date" value={newSprint.end_date}
                onChange={(e) => setNewSprint({ ...newSprint, end_date: e.target.value })} />
              <button className="btn">Add</button>
            </div>
          </form>

          <form className="panel" onSubmit={handleAddMember}>
            <h3>Add team member</h3>
            <div className="row-form">
              <select value={memberToAdd} onChange={(e) => setMemberToAdd(e.target.value)}>
                <option value="">Select a user...</option>
                {nonMembers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <button className="btn">Add</button>
            </div>
          </form>
        </div>
      )}

      {modalTask !== undefined && (
        <TaskModal
          task={modalTask}
          projectId={id}
          members={project.members}
          sprints={sprints}
          canManage={canManage}
          onClose={() => setModalTask(undefined)}
          onSaved={() => {
            setModalTask(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
