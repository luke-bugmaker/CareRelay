import { formatClock, initials } from '../lib/care.js';

/** Caregiver Shift Mode — the main interaction during the demo. */
export default function ShiftHeader({ current, next, shiftEnds, onGenerateHandoff, generating }) {
  return (
    <div className="shift">
      <div className="shift__people">
        <div className="shift__person">
          <span className="shift__role">Current caregiver</span>
          <span className="shift__name">
            <span className="avatar avatar--sm">{initials(current?.name)}</span>
            {current?.name || '—'}
          </span>
        </div>
        <span className="shift__arrow" aria-hidden="true">
          →
        </span>
        <div className="shift__person">
          <span className="shift__role">Next caregiver</span>
          <span className="shift__name">
            <span className="avatar avatar--sm">{initials(next?.name)}</span>
            {next?.name || '—'}
          </span>
        </div>
        {shiftEnds && (
          <div className="shift__person">
            <span className="shift__role">Shift ends</span>
            <span className="shift__name">{formatClock(shiftEnds)}</span>
          </div>
        )}
      </div>
      <button type="button" className="btn btn--primary btn--lg" onClick={onGenerateHandoff} disabled={generating}>
        {generating ? 'Generating…' : `Generate handoff to ${next?.name || 'next caregiver'}`}
      </button>
    </div>
  );
}
