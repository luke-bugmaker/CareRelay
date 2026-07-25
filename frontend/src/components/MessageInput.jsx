import { useEffect, useRef, useState } from 'react';

const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Text box + attachment + browser speech-to-text.
 * Enter sends, Shift+Enter makes a new line.
 */
export default function MessageInput({
  value,
  onChange,
  onSubmit,
  onFileSelected,
  attachment,
  onClearAttachment,
  disabled,
  placeholder = 'Tell CareRelay what happened…',
}) {
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);

  // Auto-grow the textarea up to a few lines.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  function toggleVoice() {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim();
      onChange(value ? `${value} ${transcript}` : transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {attachment && (
        <div className="composer__attachment">
          {attachment.type === 'image' ? (
            <img src={attachment.file_url} alt={attachment.file_name || 'Attachment'} />
          ) : (
            <span>📎</span>
          )}
          <span className="composer__attachment-name">{attachment.file_name || attachment.attachment_id}</span>
          <button type="button" className="icon-btn" onClick={onClearAttachment} aria-label="Remove attachment">
            ✕
          </button>
        </div>
      )}

      <div className="composer__row">
        <button
          type="button"
          className="icon-btn"
          onClick={() => fileRef.current?.click()}
          title="Attach a photo"
          aria-label="Attach a photo"
        >
          📎
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
            e.target.value = '';
          }}
        />

        <textarea
          ref={textRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        <button
          type="button"
          className={`icon-btn ${listening ? 'is-recording' : ''}`}
          onClick={toggleVoice}
          disabled={!SpeechRecognition}
          title={SpeechRecognition ? 'Dictate' : 'Voice input is not supported in this browser'}
          aria-label="Dictate"
        >
          🎙️
        </button>

        <button type="submit" className="btn btn--primary composer__send" disabled={disabled || !value.trim()}>
          Send
        </button>
      </div>

      <p className="composer__hint">
        {listening ? 'Listening…' : 'Enter to send · Shift + Enter for a new line · English or 中文'}
      </p>
    </form>
  );
}
