import { labelise } from '../lib/care.js';

/**
 * Shown when the Conversation Agent returns needs_clarification: true.
 * One question only — the agent is instructed never to interrogate the caregiver.
 */
export default function ClarificationCard({ question, missingFields = [], onQuickAnswer }) {
  return (
    <div className="card card--clarify">
      <div className="card__head">
        <span className="badge badge--amber">Needs one detail</span>
      </div>
      <p className="clarify__question">{question}</p>
      {missingFields.length > 0 && (
        <ul className="clarify__fields">
          {missingFields.map((f) => (
            <li key={f}>{labelise(f)}</li>
          ))}
        </ul>
      )}
      {onQuickAnswer && (
        <div className="clarify__actions">
          <button type="button" className="btn btn--ghost" onClick={() => onQuickAnswer("I don't know")}>
            I don&apos;t know
          </button>
        </div>
      )}
    </div>
  );
}
