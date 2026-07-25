import { caregiverName, formatClock, formatDayLabel } from '../lib/care.js';

/**
 * Upcoming tasks + appointments. Deliberately a flat day-grouped list, not a
 * monthly calendar (P2 in the spec).
 */
export default function ScheduleList({ items = [], caregivers = [], onToggleStatus }) {
  if (!items.length) {
    return (
      <div className="empty">
        <p>Nothing scheduled.</p>
      </div>
    );
  }

  const now = new Date();

  return (
    <ul className="schedule">
      {items.map((item) => {
        const start = new Date(item.start_time);
        const overdue = item.status === 'pending' && start < now;
        const done = item.status === 'completed';
        return (
          <li key={item.id} className={`schedule__item ${overdue ? 'is-overdue' : ''} ${done ? 'is-done' : ''}`}>
            <button
              type="button"
              className={`check ${done ? 'is-checked' : ''}`}
              onClick={() => onToggleStatus?.(item, done ? 'pending' : 'completed')}
              aria-label={done ? `Mark ${item.title} as pending` : `Mark ${item.title} as completed`}
            >
              {done ? '✓' : ''}
            </button>
            <div className="schedule__body">
              <div className="schedule__title">
                <strong>{item.title}</strong>
                {overdue && <span className="badge badge--amber">No completion record</span>}
              </div>
              <div className="schedule__meta">
                <span>{formatDayLabel(item.start_time)}</span>
                <span className="sep">·</span>
                <span>
                  {formatClock(item.start_time)}
                  {item.end_time ? ` – ${formatClock(item.end_time)}` : ''}
                </span>
                <span className="sep">·</span>
                <span>{caregiverName(caregivers, item.assigned_caregiver_id, 'Unassigned')}</span>
              </div>
              {item.notes && <p className="schedule__notes">{item.notes}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
