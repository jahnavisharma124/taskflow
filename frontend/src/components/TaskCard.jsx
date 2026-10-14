// A single card on the Kanban board. Draggable between columns.
export default function TaskCard({ task, onClick }) {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const overdue = task.due_date && task.due_date < today && task.status !== 'done';

  function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div className="task-card" draggable onDragStart={handleDragStart} onClick={onClick}>
      <div className="task-title">{task.title}</div>
      <div className="task-meta">
        <span className={`priority priority-${task.priority}`}>{task.priority}</span>
        {task.assignee_name && <span className="muted">{task.assignee_name}</span>}
      </div>
      {task.due_date && (
        <div className={overdue ? 'due overdue' : 'due'}>
          Due {task.due_date.slice(0, 10)}{overdue ? ' (overdue)' : ''}
        </div>
      )}
    </div>
  );
}
