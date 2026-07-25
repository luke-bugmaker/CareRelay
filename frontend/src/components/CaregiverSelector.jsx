import { initials } from '../lib/care.js';

/** "Who is writing this update?" — the MVP's stand-in for real authentication. */
export default function CaregiverSelector({ caregivers = [], value, onChange, label = 'Signed in as', className = '' }) {
  return (
    <div className={`caregiver-selector ${className}`.trim()}>
      <span className="caregiver-selector__label">{label}</span>
      <div className="caregiver-selector__options" role="radiogroup" aria-label="Select caregiver">
        {caregivers.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`chip chip--person ${active ? 'is-active' : ''}`}
              onClick={() => onChange(c.id)}
            >
              <span className="avatar avatar--sm">{initials(c.name)}</span>
              <span className="chip__text">
                {c.name}
                <small>{c.relationship}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
