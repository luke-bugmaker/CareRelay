import { useState } from 'react';
import { toLocalISO } from '../services/api.js';

/** Local datetime string accepted by <input type="datetime-local">, rounded to the next half hour. */
function defaultStart() {
  const d = new Date();
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function plusHour(inputValue) {
  const d = new Date(inputValue);
  d.setHours(d.getHours() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY = (assignee = '') => ({
  title: '',
  mode: 'deadline', // 'deadline' = one moment, 'period' = start + end
  start: defaultStart(),
  end: plusHour(defaultStart()),
  notes: '',
  assignee,
});

/**
 * Manual entry for the Upcoming tasks panel — the non-AI path into the same
 * /api/schedules endpoint the chat agent writes to, so conflicts are still detected.
 */
export default function AddTaskForm({ caregivers = [], defaultAssignee = '', onCreate, onCancel }) {
  const [draft, setDraft] = useState(() => EMPTY(defaultAssignee));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  async function submit(e) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError('Give the task a title.');
      return;
    }
    if (draft.mode === 'period' && new Date(draft.end) <= new Date(draft.start)) {
      setError('The end time must be after the start time.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCreate({
        title: draft.title.trim(),
        start_time: toLocalISO(new Date(draft.start)),
        end_time: draft.mode === 'period' ? toLocalISO(new Date(draft.end)) : null,
        assigned_caregiver_id: draft.assignee || null,
        notes: draft.notes.trim() || null,
      });
      setDraft(EMPTY(defaultAssignee));
    } catch (err) {
      setError(`Task could not be added: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="form-grid__wide">
          Task
          <input
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Physiotherapy session"
            autoFocus
          />
        </label>

        <label>
          Timing
          <select value={draft.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="deadline">Deadline (one time)</option>
            <option value="period">Time period (start – end)</option>
          </select>
        </label>

        <label>
          {draft.mode === 'period' ? 'Starts' : 'Due'}
          <input
            type="datetime-local"
            value={draft.start}
            onChange={(e) => set({ start: e.target.value, end: plusHour(e.target.value) })}
          />
        </label>

        {draft.mode === 'period' && (
          <label>
            Ends
            <input type="datetime-local" value={draft.end} onChange={(e) => set({ end: e.target.value })} />
          </label>
        )}

        <label>
          Who should do this
          <select value={draft.assignee} onChange={(e) => set({ assignee: e.target.value })}>
            <option value="">Unassigned</option>
            {caregivers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.relationship ? ` · ${c.relationship}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="form-grid__wide">
          Detail
          <input
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Optional — anything the next caregiver needs to know"
          />
        </label>
      </div>

      {error && <p className="task-form__error">{error}</p>}

      <div className="task-form__actions">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add task'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
