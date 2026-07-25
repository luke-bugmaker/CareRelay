import { formatDateLong, shiftDateKey } from '../lib/care.js';
import { toDateKey } from '../services/api.js';

export default function DateSelector({ value, onChange }) {
  const today = toDateKey(new Date());
  return (
    <div className="date-selector">
      <button type="button" className="icon-btn" onClick={() => onChange(shiftDateKey(value, -1))} aria-label="Previous day">
        ‹
      </button>
      <div className="date-selector__label">
        <strong>{formatDateLong(value)}</strong>
        {value === today && <span className="badge badge--teal">Today</span>}
      </div>
      <button type="button" className="icon-btn" onClick={() => onChange(shiftDateKey(value, 1))} aria-label="Next day">
        ›
      </button>
      <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Pick a date" />
    </div>
  );
}
