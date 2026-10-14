import { useEffect, useState } from 'react';
import { api } from '../api';

// Popup for creating a new task (task = null) or editing an existing one.
export default function TaskModal({ task, projectId, members, sprints, canManage, onClose, onSaved }) {
  const editing = Boolean(task);

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    assignee_id: task?.assignee_id ?? '',
    sprint_id: task?.sprint_id ?? '',
    due_date: task?.due_date ? task.due_date.slice(0, 10) : '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    if (!editing) return;
    api(`/tasks/${task.id}/comments`)
      .then(setComments)
      .catch((err) => setError(err.message));
  }, [editing, task]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    // Empty strings must become null, otherwise MySQL rejects them for number/date columns
    const body = {
      title: form.title.trim(),
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      sprint_id: form.sprint_id ? Number(form.sprint_id) : null,
      due_date: form.due_date || null,
    };

    try {
      if (editing) {
        await api(`/tasks/${task.id}`, { method: 'PATCH', body });
      } else {
        await api(`/projects/${projectId}/tasks`, { method: 'POST', body });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api(`/tasks/${task.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api(`/tasks/${task.id}/comments`, { method: 'POST', body: { body: newComment } });
      setNewComment('');
      setComments(await api(`/tasks/${task.id}/comments`));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editing ? 'Edit task' : 'New task'}</h2>
          <button className="btn btn-small" onClick={onClose}>Close</button>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSave}>
          <label>Title
            <input value={form.title} onChange={(e) => setField('title', e.target.value)} required />
          </label>
          <label>Description
            <textarea rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} />
          </label>

          <div className="two-col">
            <label>Status
              <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label>Priority
              <select value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="two-col">
            <label>Assignee
              <select value={form.assignee_id} onChange={(e) => setField('assignee_id', e.target.value)}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label>Sprint
              <select value={form.sprint_id} onChange={(e) => setField('sprint_id', e.target.value)}>
                <option value="">No sprint</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label>Due date
            <input type="date" value={form.due_date} onChange={(e) => setField('due_date', e.target.value)} />
          </label>

          <div className="modal-actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            {editing && canManage && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
            )}
          </div>
        </form>

        {editing && (
          <div className="comments">
            <h3>Comments</h3>
            {comments.length === 0 && <p className="muted">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <strong>{c.user_name}</strong> <span className="muted">{String(c.created_at).slice(0, 16)}</span>
                <div>{c.body}</div>
              </div>
            ))}
            <form className="row-form" onSubmit={handleComment}>
              <input placeholder="Write a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
              <button className="btn">Post</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
