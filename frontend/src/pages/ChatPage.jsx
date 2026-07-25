import { useEffect, useMemo, useRef, useState } from 'react';
import ChatMessage from '../components/ChatMessage.jsx';
import ClarificationCard from '../components/ClarificationCard.jsx';
import ConflictAlert from '../components/ConflictAlert.jsx';
import EventPreview from '../components/EventPreview.jsx';
import MessageInput from '../components/MessageInput.jsx';
import { api, toLocalISO } from '../services/api.js';
import { caregiverName } from '../lib/care.js';

// Keys must not collide with messages restored from localStorage, whose counter
// started over in a previous session — hence the per-session prefix.
const SESSION = Math.random().toString(36).slice(2, 6);
let messageSeq = 0;
const nextKey = () => `m${SESSION}_${++messageSeq}`;

/**
 * The conversation itself (messages, draft text, pending attachment) is owned by App,
 * which keeps one thread per caregiver. This page is unmounted every time the user opens
 * the Care Board, so anything kept in local state here would be wiped on the way back.
 * Identity is switched from the topbar, not here.
 */
export default function ChatPage({
  recipient,
  caregivers,
  caregiverId,
  onDataChanged,
  messages,
  setMessages,
  input,
  setInput,
  attachment,
  setAttachment,
  conversationId,
}) {
  const scrollRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [busyConflict, setBusyConflict] = useState(null);

  const activeName = useMemo(() => caregiverName(caregivers, caregiverId, 'You'), [caregivers, caregiverId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function push(message) {
    setMessages((prev) => [...prev, { key: nextKey(), time: toLocalISO(new Date()), ...message }]);
  }

  async function handleFile(file) {
    try {
      const uploaded = await api.uploadAttachment(file, caregiverId);
      setAttachment({ ...uploaded, file_name: uploaded.file_name || file.name });
    } catch (err) {
      push({ role: 'assistant', type: 'text', text: `The photo could not be uploaded (${err.message}). You can still send the update as text.` });
    }
  }

  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    const sentAttachment = attachment;
    setInput('');
    setAttachment(null);
    setSending(true);

    push({ role: 'user', type: 'text', text, attachment: sentAttachment || undefined });
    const pendingKey = nextKey();
    setMessages((prev) => [...prev, { key: pendingKey, role: 'assistant', type: 'text', pending: true, time: toLocalISO(new Date()) }]);

    try {
      const res = await api.sendChat({
        careRecipientId: recipient?.id,
        caregiverId,
        conversationId,
        message: text,
        attachmentIds: sentAttachment ? [sentAttachment.attachment_id] : [],
      });

      if (res.clarification_required) {
        setMessages((prev) =>
          prev.map((m) =>
            m.key === pendingKey
              ? {
                  ...m,
                  pending: false,
                  type: 'clarification',
                  question: res.structured?.clarification_question || res.assistant_message,
                  missingFields: res.structured?.missing_fields || [],
                }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.key === pendingKey
              ? { ...m, pending: false, text: res.assistant_message || 'Ready for review.' }
              : m
          )
        );
      }

      for (const event of res.preview_events || res.created_events || []) {
        push({ role: 'assistant', type: 'preview', event });
      }

      if (res.preview_schedule) {
        push({
          role: 'assistant',
          type: 'writeApproval',
          approvalId: res.approval_id,
          schedule: res.preview_schedule,
        });
      }

      if (res.conflicts?.length) {
        push({ role: 'assistant', type: 'conflict', conflicts: res.conflicts });
      }

      onDataChanged?.();
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.key === pendingKey
            ? { ...m, pending: false, text: `CareRelay could not process that update: ${err.message}. Please try again.` }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(eventId, patch) {
    const pending = messages.find((m) => m.type === 'preview' && m.event.id === eventId)?.event;
    if (pending?.approval_id) {
      setMessages((prev) =>
        prev.map((m) =>
          m.type === 'preview' && m.event.id === eventId
            ? { ...m, event: { ...m.event, ...patch } }
            : m
        )
      );
      return;
    }
    await api.updateEvent(eventId, patch);
    setMessages((prev) =>
      prev.map((m) => (m.type === 'preview' && m.event.id === eventId ? { ...m, event: { ...m.event, ...patch } } : m))
    );
    onDataChanged?.();
  }

  async function confirmEvent(eventId) {
    const pending = messages.find((m) => m.type === 'preview' && m.event.id === eventId)?.event;
    if (pending?.approval_id) {
      const pendingEvents = messages
        .filter((m) => m.type === 'preview' && m.event.approval_id === pending.approval_id)
        .map((m) => m.event);
      const result = await api.confirmChatAction({
        approvalId: pending.approval_id,
        approved: true,
        careEvents: pendingEvents.map((event) => ({
          category: event.category,
          event_time: event.event_time,
          title: event.title,
          details: event.details_json || {},
          status: event.status || 'completed',
        })),
      });
      setMessages((prev) =>
        prev.filter((m) => !(m.type === 'preview' && m.event.approval_id === pending.approval_id))
      );
      push({ role: 'assistant', type: 'text', text: 'Saved to the care board.' });
      if (result.conflicts?.length) {
        push({ role: 'assistant', type: 'conflict', conflicts: result.conflicts });
      }
      onDataChanged?.();
      return;
    }
    await api.updateEvent(eventId, { confirmed_by_user: true });
    setMessages((prev) => prev.filter((m) => !(m.type === 'preview' && m.event.id === eventId)));
    push({ role: 'assistant', type: 'text', text: 'Saved to the care board.' });
    onDataChanged?.();
  }

  async function rejectEvent(eventId) {
    const pending = messages.find((m) => m.type === 'preview' && m.event.id === eventId)?.event;
    if (!pending?.approval_id) return;
    await api.confirmChatAction({ approvalId: pending.approval_id, approved: false });
    setMessages((prev) =>
      prev.filter((m) => !(m.type === 'preview' && m.event.approval_id === pending.approval_id))
    );
    push({ role: 'assistant', type: 'text', text: 'Discarded. Nothing was saved.' });
  }

  async function decideSchedule(approvalId, approved) {
    const result = await api.confirmChatAction({ approvalId, approved });
    setMessages((prev) => prev.filter((m) => !(m.type === 'writeApproval' && m.approvalId === approvalId)));
    if (!approved) {
      push({ role: 'assistant', type: 'text', text: 'Discarded. Nothing was saved.' });
      return;
    }
    if (result.conflicts?.length) {
      push({ role: 'assistant', type: 'conflict', conflicts: result.conflicts });
    } else {
      push({ role: 'assistant', type: 'text', text: 'Schedule saved to the care board.' });
      onDataChanged?.();
    }
  }

  async function resolveConflict(conflict, resolution) {
    if (resolution === 'edit_new_item') {
      setInput(`Change ${conflict.incoming?.title} to `);
      return;
    }
    setBusyConflict(conflict.id);
    try {
      await api.resolveConflict({ conflictId: conflict.id, resolution });
      setMessages((prev) =>
        prev.map((m) =>
          m.type === 'conflict' ? { ...m, conflicts: m.conflicts.filter((c) => c.id !== conflict.id) } : m
        )
      );
      push({
        role: 'assistant',
        type: 'text',
        text: resolution === 'replace_existing' ? 'The earlier entry was replaced.' : 'Both entries were kept.',
      });
      onDataChanged?.();
    } finally {
      setBusyConflict(null);
    }
  }

  return (
    <div className="chat">
      <div className="chat__scroll" ref={scrollRef}>
        <div className="chat__inner">
          {messages.map((m) => {
            if (m.type === 'system') {
              return (
                <p key={m.key} className="chat__system">
                  {m.text}
                </p>
              );
            }
            if (m.type === 'clarification') {
              return (
                <ClarificationCard
                  key={m.key}
                  question={m.question}
                  missingFields={m.missingFields}
                  onQuickAnswer={(answer) => send(answer)}
                />
              );
            }
            if (m.type === 'preview') {
              return (
                <EventPreview
                  key={m.key}
                  event={m.event}
                  caregiverName={caregiverName(caregivers, m.event.caregiver_id, activeName)}
                  onSave={saveEdit}
                  onConfirm={confirmEvent}
                  onReject={rejectEvent}
                />
              );
            }
            if (m.type === 'writeApproval') {
              return (
                <div key={m.key} className="card card--preview">
                  <div className="card__head">
                    <span className="badge">Confirm schedule</span>
                  </div>
                  <dl className="kv">
                    <div><dt>Title</dt><dd>{m.schedule.title}</dd></div>
                    <div><dt>Start</dt><dd>{new Date(m.schedule.start_time).toLocaleString()}</dd></div>
                  </dl>
                  <div className="card__actions">
                    <button type="button" className="btn btn--primary" onClick={() => decideSchedule(m.approvalId, true)}>
                      Confirm
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={() => decideSchedule(m.approvalId, false)}>
                      Reject
                    </button>
                  </div>
                </div>
              );
            }
            if (m.type === 'conflict') {
              return m.conflicts.length ? (
                <ConflictAlert key={m.key} conflicts={m.conflicts} onResolve={resolveConflict} busyId={busyConflict} />
              ) : null;
            }
            return <ChatMessage key={m.key} message={m} caregiverName={activeName} />;
          })}
        </div>
      </div>

      <div className="chat__bottom">
        <MessageInput
          value={input}
          onChange={setInput}
          onSubmit={() => send()}
          onFileSelected={handleFile}
          attachment={attachment}
          onClearAttachment={() => setAttachment(null)}
          disabled={sending}
        />
      </div>
    </div>
  );
}
