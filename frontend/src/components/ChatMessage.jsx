import { formatClock, initials } from '../lib/care.js';

export default function ChatMessage({ message, caregiverName }) {
  const isUser = message.role === 'user';

  return (
    <div className={`msg ${isUser ? 'msg--user' : 'msg--assistant'}`}>
      <div className="msg__avatar avatar" aria-hidden="true">
        {isUser ? initials(caregiverName || 'You') : 'AI'}
      </div>
      <div className="msg__body">
        <div className="msg__meta">
          <span className="msg__author">{isUser ? caregiverName || 'You' : 'CareRelay'}</span>
          <span className="msg__time">{formatClock(message.time)}</span>
        </div>
        <div className="msg__bubble">
          {message.pending ? (
            <span className="typing" aria-label="CareRelay is thinking">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <p>{message.text}</p>
          )}
          {message.attachment &&
            (message.attachment.file_url ? (
              <a className="msg__attachment" href={message.attachment.file_url} target="_blank" rel="noreferrer">
                {message.attachment.type === 'image' ? (
                  <img src={message.attachment.file_url} alt={message.attachment.file_name || 'Attachment'} />
                ) : (
                  <span>📎 {message.attachment.file_name}</span>
                )}
              </a>
            ) : (
              // Restored from a previous session — the browser URL for the file is gone.
              <span className="msg__attachment--expired">📎 {message.attachment.file_name || 'Photo'} · not kept after reload</span>
            ))}
        </div>
      </div>
    </div>
  );
}
