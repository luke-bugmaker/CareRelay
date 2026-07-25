import { initials } from '../lib/care.js';

export default function CareRecipientHeader({ recipient }) {
  if (!recipient) return null;
  return (
    <div className="recipient">
      <span className="avatar avatar--lg">{initials(recipient.name)}</span>
      <div className="recipient__text">
        <strong>{recipient.full_name || recipient.name}</strong>
        <small>
          {recipient.age ? `${recipient.age} · ` : ''}
          {recipient.notes || 'Care recipient'}
        </small>
      </div>
    </div>
  );
}
