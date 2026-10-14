import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import './ProjectReport.css';

const STATUS_LABEL = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

function pct(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export default function ProjectReport() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/projects/${id}/report`).then(setReport).catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div>
        <div className="error">{error}</div>
        <Link to={`/projects/${id}`}>Back to board</Link>
      </div>
    );
  }
  if (!report) return <p className="muted">Loading...</p>;

  const { totals, sprints, members, top_tasks } = report;

  return (
    <div>
      <Link to={`/projects/${id}`} className="muted">&larr; Back to board</Link>
      <h1>{report.project.name} - Report</h1>

      <div className="stat-row">
        <div className="stat"><div className="stat-num">{totals.total_tasks}</div><div className="muted">Total tasks</div></div>
        <div className="stat"><div className="stat-num">{pct(totals.done_tasks, totals.total_tasks)}%</div><div className="muted">Completed ({totals.done_tasks})</div></div>
        <div className="stat"><div className={totals.overdue_tasks > 0 ? 'stat-num overdue' : 'stat-num'}>{totals.overdue_tasks}</div><div className="muted">Overdue</div></div>
        <div className="stat"><div className="stat-num">{totals.total_hours.toFixed(1)}</div><div className="muted">Hours logged</div></div>
      </div>

      <section className="panel">
        <h3>Sprints</h3>
        {sprints.length === 0 ? <p className="muted">No sprints yet.</p> : (
          <table className="report-table">
            <thead><tr><th>Sprint</th><th>Dates</th><th>Progress</th><th>Hours</th></tr></thead>
            <tbody>
              {sprints.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="muted">{s.start_date || '-'} to {s.end_date || '-'}</td>
                  <td>
                    <div className="bar"><div className="bar-fill" style={{ width: `${pct(s.done_count, s.task_count)}%` }} /></div>
                    <span className="muted">{s.done_count}/{s.task_count} done</span>
                  </td>
                  <td>{s.hours.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h3>Team</h3>
        <table className="report-table">
          <thead><tr><th>Member</th><th>Hours logged</th><th>Open tasks</th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}><td>{m.name}</td><td>{m.hours.toFixed(1)}</td><td>{m.open_tasks}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Most time spent on</h3>
        {top_tasks.length === 0 ? <p className="muted">No time logged yet.</p> : (
          <table className="report-table">
            <thead><tr><th>Task</th><th>Status</th><th>Hours</th></tr></thead>
            <tbody>
              {top_tasks.map((t) => (
                <tr key={t.id}><td>{t.title}</td><td>{STATUS_LABEL[t.status]}</td><td>{t.hours.toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
