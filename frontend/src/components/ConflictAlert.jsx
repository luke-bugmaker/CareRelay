import { formatClock, formatDayLabel } from '../lib/care.js';

const ACTION_LABEL = {
  keep_both: 'Keep both',
  replace_existing: 'Replace existing',
  edit_new_item: 'Edit new time',
  discard_new: 'Discard new',
};

/**
 * Output of the deterministic Python conflict engine — never an AI judgement.
 * The wording says "possible", because the system only knows what was recorded.
 */
export default function ConflictAlert({ conflicts = [], onResolve, busyId }) {
  if (!conflicts.length) return null;

  return (
    <div className="stack">
      {conflicts.map((conflict) => (
        <div key={conflict.id} className="card card--conflict">
          <div className="card__head">
            <span className="badge badge--amber">
              {conflict.type === 'possible_duplicate' ? 'Possible duplicate' : 'Schedule overlap'}
            </span>
          </div>
          <p className="conflict__message">{conflict.message}</p>

          <div className="conflict__compare">
            <div>
              <span className="conflict__label">Existing</span>
              <strong>{conflict.existing?.title}</strong>
              <span className="conflict__time">
                {formatDayLabel(conflict.existing?.start_time)} · {formatClock(conflict.existing?.start_time)}
              </span>
            </div>
            <div className="conflict__vs" aria-hidden="true">
              vs
            </div>
            <div>
              <span className="conflict__label">New</span>
              <strong>{conflict.incoming?.title}</strong>
              <span className="conflict__time">
                {formatDayLabel(conflict.incoming?.start_time)} · {formatClock(conflict.incoming?.start_time)}
              </span>
            </div>
          </div>

          <div className="card__actions">
            {(conflict.resolution_options || ['keep_both', 'replace_existing', 'edit_new_item']).map((option) => (
              <button
                key={option}
                type="button"
                className={`btn ${option === 'keep_both' ? 'btn--primary' : 'btn--ghost'}`}
                disabled={busyId === conflict.id}
                onClick={() => onResolve?.(conflict, option)}
              >
                {ACTION_LABEL[option] || option}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
