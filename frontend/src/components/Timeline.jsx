import { categoryMeta, caregiverName, describeDetails, formatTime } from '../lib/care.js';
import { attachmentById } from '../services/api.js';

const SOURCE_LABEL = { text: 'Text', voice: 'Voice', image: 'Photo', manual: 'Manual' };

/**
 * An event carries `attachment_id`; the board needs a URL. Mock mode embeds the
 * whole attachment, live mode is resolved through the upload registry in api.js.
 */
function eventAttachment(event) {
  if (event.attachment?.file_url) return event.attachment;
  if (event.attachment_url) return { file_url: event.attachment_url, type: 'image', file_name: event.title };
  return attachmentById(event.attachment_id);
}

export default function Timeline({ events = [], caregivers = [], highlightId = null, emptyHint }) {
  if (!events.length) {
    return (
      <div className="empty">
        <p>No care events recorded for this day yet.</p>
        {emptyHint && <p className="empty__hint">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <ol className="timeline">
      {events.map((event) => {
        const meta = categoryMeta(event.category);
        const attachment = eventAttachment(event);
        return (
          <li
            key={event.id}
            id={`event-${event.id}`}
            className={`timeline__item tone-${meta.tone} ${highlightId === event.id ? 'is-highlighted' : ''}`}
          >
            <div className="timeline__time">{formatTime(event.event_time)}</div>
            <div className="timeline__rail" aria-hidden="true">
              <span className={`dot dot--${meta.tone}`} />
            </div>
            <div className="timeline__content">
              <div className="timeline__title">
                <span className="timeline__icon" aria-hidden="true">
                  {meta.icon}
                </span>
                <strong>{event.title}</strong>
                <span className={`badge badge--${meta.tone}`}>{meta.label}</span>
                {event.confirmed_by_user === false && <span className="badge badge--amber">Unconfirmed</span>}
              </div>
              {describeDetails(event.details_json) && <p className="timeline__details">{describeDetails(event.details_json)}</p>}

              {attachment?.file_url &&
                (attachment.type === 'file' ? (
                  <a className="timeline__file" href={attachment.file_url} target="_blank" rel="noreferrer">
                    📎 {attachment.file_name || 'Attachment'}
                  </a>
                ) : (
                  <a
                    className="timeline__photo"
                    href={attachment.file_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open the full photo"
                  >
                    <img src={attachment.file_url} alt={attachment.file_name || `Photo for ${event.title}`} loading="lazy" />
                  </a>
                ))}

              <div className="timeline__foot">
                <span>{caregiverName(caregivers, event.caregiver_id)}</span>
                <span className="sep">·</span>
                <span>{SOURCE_LABEL[event.source_type] || 'Text'}</span>
                {event.raw_input && (
                  <>
                    <span className="sep">·</span>
                    <span className="timeline__raw" title={event.raw_input}>
                      “{event.raw_input}”
                    </span>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
