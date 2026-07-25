import { useState } from 'react';
import { caregiverName, formatClock } from '../lib/care.js';

const SECTIONS = [
  { key: 'completed', title: 'Completed', tone: 'green' },
  { key: 'needs_attention', title: 'Needs attention', tone: 'amber' },
  { key: 'condition_changes', title: 'Condition changes', tone: 'red' },
  { key: 'upcoming', title: 'Upcoming', tone: 'blue' },
  { key: 'conflicts', title: 'Conflicts', tone: 'amber' },
  { key: 'unconfirmed_information', title: 'Unconfirmed information', tone: 'grey' },
];

function toPlainText(handoff) {
  return SECTIONS.filter((s) => handoff[s.key]?.length)
    .map((s) => `${s.title}\n${handoff[s.key].map((i) => `- ${i.text}`).join('\n')}`)
    .join('\n\n');
}

/**
 * Handoff Summary Agent output. Every line keeps its source record ids so the
 * next caregiver can check the original message — the summary is traceable,
 * not unsupported AI text.
 */
export default function HandoffCard({ handoff, events = [], caregivers = [], onTrace, onRegenerate }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(toPlainText(handoff));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const filled = SECTIONS.filter((s) => handoff[s.key]?.length);

  return (
    <div className="card card--handoff">
      <div className="card__head card__head--split">
        <div>
          <h3>Handoff summary</h3>
          <p className="card__sub">
            {caregiverName(caregivers, handoff.from_caregiver?.id, handoff.from_caregiver?.name || 'Current caregiver')} →{' '}
            <strong>{handoff.next_caregiver?.name || 'Next caregiver'}</strong> · generated {formatClock(handoff.generated_at)}
          </p>
        </div>
        <div className="card__actions">
          <button type="button" className="btn btn--ghost" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          {onRegenerate && (
            <button type="button" className="btn btn--ghost" onClick={onRegenerate}>
              Regenerate
            </button>
          )}
        </div>
      </div>

      {filled.length === 0 && <p className="empty__hint">Nothing recorded in this time range.</p>}

      {filled.map((section) => (
        <section key={section.key} className="handoff__section">
          <h4>
            <span className={`dot dot--${section.tone}`} /> {section.title}
          </h4>
          <ul>
            {handoff[section.key].map((item, i) => (
              <li key={`${section.key}-${i}`}>
                <span>{item.text}</span>
                <span className="handoff__sources">
                  {(item.event_ids || []).map((id) => {
                    const source = events.find((e) => e.id === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className="source-chip"
                        title={source ? `${caregiverName(caregivers, source.caregiver_id)}: “${source.raw_input}”` : id}
                        onClick={() => onTrace?.(id)}
                      >
                        source
                      </button>
                    );
                  })}
                  {(item.schedule_ids || []).map((id) => (
                    <span key={id} className="source-chip source-chip--static" title={id}>
                      schedule
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
