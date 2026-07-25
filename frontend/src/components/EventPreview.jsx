import { useState } from 'react';
import { CATEGORY_META, categoryMeta, describeDetails, formatClock } from '../lib/care.js';
import { toLocalISO } from '../services/api.js';

/** ISO → value accepted by <input type="datetime-local"> */
function toInputValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * "AI understood: …" confirmation card (P1 in the spec).
 * The event is a write preview. Nothing is persisted until Confirm is pressed.
 */
export default function EventPreview({ event, caregiverName, onSave, onConfirm, onReject }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    title: event.title,
    category: event.category,
    event_time: toInputValue(event.event_time),
    note: describeDetails(event.details_json),
  });
  const meta = categoryMeta(event.category);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(event.id, {
        title: draft.title,
        category: draft.category,
        event_time: toLocalISO(new Date(draft.event_time)),
        details_json: { ...event.details_json, note: draft.note },
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`card card--preview tone-${meta.tone}`}>
      <div className="card__head">
        <span className="badge">AI understood</span>
        <span className="card__source">from “{event.raw_input}”</span>
      </div>

      {editing ? (
        <div className="form-grid">
          <label>
            Title
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label>
            Category
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {Object.entries(CATEGORY_META).map(([key, m]) => (
                <option key={key} value={key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time
            <input
              type="datetime-local"
              value={draft.event_time}
              onChange={(e) => setDraft({ ...draft, event_time: e.target.value })}
            />
          </label>
          <label className="form-grid__wide">
            Details
            <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          <div className="card__actions form-grid__wide">
            <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="kv">
            <div>
              <dt>Category</dt>
              <dd>
                <span className={`dot dot--${meta.tone}`} /> {meta.label}
              </dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatClock(event.event_time)}</dd>
            </div>
            <div>
              <dt>Detail</dt>
              <dd>{describeDetails(event.details_json) || event.title}</dd>
            </div>
            <div>
              <dt>Recorded by</dt>
              <dd>{caregiverName}</dd>
            </div>
          </dl>
          <div className="card__actions">
            <button type="button" className="btn btn--primary" onClick={() => onConfirm?.(event.id)}>
              Confirm
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onReject?.(event.id)}>
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
}
