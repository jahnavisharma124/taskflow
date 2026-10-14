import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import './TimeLogs.css';

// Time tracking section shown inside the task popup (existing tasks only).
export default function TimeLogs({ taskId, canManage }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA')); // today, YYYY-MM-DD
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadLogs() {
    try {
      setLogs(await api(`/tasks/${taskId}/time-logs`));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(`/tasks/${taskId}/time-logs`, {
        method: 'POST',
        body: { hours: Number(hours), log_date: date, note: note.trim() || null },
      });
      setHours('');
      setNote('');
      await loadLogs();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this time entry?')) return;
    try {
      await api(`/time-logs/${id}`, { method: 'DELETE' });
      await loadLogs();
    } catch (err) {
      setError(err.message);
    }
  }

  const total = logs.reduce((sum, l) => sum + l.hours, 0);

  return (
    <div className="timelogs">
      <h3>Time logged <span className="count">{total.toFixed(2)} h</span></h3>
      {error && <div className="error">{error}</div>}

      {logs.length === 0 && <p className="muted">No time logged yet.</p>}
      {logs.map((l) => (
        <div key={l.id} className="timelog-row">
          <div>
            <strong>{l.hours} h</strong> <span className="muted">{l.log_date} · {l.user_name}</span>
            {l.note && <div className="timelog-note">{l.note}</div>}
          </div>
          {(l.user_id === user.id || canManage) && (
            <button type="button" className="btn btn-small" onClick={() => handleDelete(l.id)}>Delete</button>
          )}
        </div>
      ))}

      <form className="timelog-form" onSubmit={handleAdd}>
        <input type="number" step="0.25" min="0.25" max="24" placeholder="Hours" value={hours}
          onChange={(e) => setHours(e.target.value)} required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input placeholder="What did you work on? (optional)" maxLength={255} value={note}
          onChange={(e) => setNote(e.target.value)} />
        <button className="btn" disabled={busy}>Log time</button>
      </form>
    </div>
  );
}
