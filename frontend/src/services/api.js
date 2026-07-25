/**
 * Single place where the frontend talks to FastAPI.
 *
 * Every call tries the real backend first. If the backend is not running yet
 * (or the endpoint is not built yet) the call transparently falls back to
 * mockBackend.js and the UI flips a "Demo data" badge on, so the frontend stays
 * demoable without Python or an API key.
 *
 * Force one mode explicitly with .env:
 *   VITE_FORCE_MOCK=true   → never hit the network
 *   VITE_FORCE_LIVE=true   → never fall back (errors surface instead)
 */
import { mock, toDateKey, toLocalISO } from './mockBackend.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const FORCE_MOCK = import.meta.env.VITE_FORCE_MOCK === 'true';
const FORCE_LIVE = import.meta.env.VITE_FORCE_LIVE === 'true';
// Model calls commonly take longer than an ordinary CRUD request.
const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 90000);

let mode = FORCE_MOCK ? 'mock' : 'unknown'; // 'live' | 'mock' | 'unknown'
const modeListeners = new Set();

/**
 * Uploaded photos, keyed by attachment_id. A care event only carries
 * `attachment_id`, so the Care Board has no URL to render — this is where it
 * gets one back. Live mode returns a real /uploads/… path, mock mode a blob URL.
 */
const attachmentRegistry = new Map();

export function attachmentById(attachmentId) {
  return attachmentId ? attachmentRegistry.get(attachmentId) || null : null;
}

export function getMode() {
  return mode;
}

export function onModeChange(listener) {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

function setMode(next) {
  if (mode === next) return;
  mode = next;
  modeListeners.forEach((l) => l(next));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Request timed out after ${Math.round(TIMEOUT_MS / 1000)} seconds`)),
    TIMEOUT_MS
  );
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param path   endpoint path, e.g. '/api/care-board'
 * @param init   fetch init (method/body/headers)
 * @param fallback  () => Promise<any> — the mock implementation
 */
async function request(path, init, fallback) {
  if (FORCE_MOCK) return fallback();

  try {
    const res = await fetchWithTimeout(`${API_BASE}${path}`, {
      headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      ...init,
    });

    // 404/5xx means "backend does not implement this yet" → use the mock.
    if (res.status === 404 || res.status >= 500) {
      if (FORCE_LIVE) throw new Error(`Backend returned ${res.status} for ${path}`);
      setMode('mock');
      return fallback();
    }

    setMode('live');
    if (res.status === 204) return null;

    const data = await res.json();
    if (!res.ok) {
      // 4xx with a JSON body is a real business response (validation, conflict…).
      const message = data?.detail || data?.message || `Request failed (${res.status})`;
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (err) {
    const isNetworkFailure = err.name === 'AbortError' || err instanceof TypeError;
    if (isNetworkFailure && !FORCE_LIVE) {
      setMode('mock');
      return fallback();
    }
    throw err;
  }
}

const json = (body) => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  /** Caregiver list + care recipient + current shift. */
  getBootstrap() {
    return request('/api/bootstrap', { method: 'GET' }, () => mock.getBootstrap());
  },

  /** GET /api/care-board?care_recipient_id=…&date=yyyy-mm-dd */
  getCareBoard({ careRecipientId = 'recipient_001', date }) {
    const dateKey = date || toDateKey(new Date());
    const qs = new URLSearchParams({ care_recipient_id: careRecipientId, date: dateKey });
    return request(`/api/care-board?${qs}`, { method: 'GET' }, () => mock.getCareBoard({ date: dateKey }));
  },

  /** POST /api/chat — the conversation-agent entry point. */
  sendChat({ careRecipientId = 'recipient_001', caregiverId, conversationId, message, attachmentIds = [] }) {
    const body = {
      care_recipient_id: careRecipientId,
      caregiver_id: caregiverId,
      conversation_id: conversationId,
      message,
      attachment_ids: attachmentIds,
      client_time: toLocalISO(new Date()),
    };
    return request('/api/chat', json(body), () =>
      mock.sendChat({ caregiver_id: caregiverId, message, client_time: body.client_time, attachment_ids: attachmentIds })
    );
  },

  /** POST /api/chat/confirm — approve or reject an AI-proposed write. */
  confirmChatAction({ approvalId, approved, careEvents }) {
    const body = {
      approval_id: approvalId,
      approved,
      ...(careEvents ? { care_events: careEvents } : {}),
    };
    return request('/api/chat/confirm', json(body), async () => ({
      status: approved ? 'saved' : 'rejected',
      created_events: [],
      created_event_ids: [],
      created_schedule: null,
      conflicts: [],
    }));
  },

  /** POST /api/events — manual fallback when AI extraction is wrong. */
  createEvent(payload) {
    return request('/api/events', json(payload), () => mock.createEvent(payload));
  },

  /** PATCH /api/events/{id} */
  updateEvent(eventId, patch) {
    return request(`/api/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(patch) }, () =>
      mock.updateEvent(eventId, patch)
    );
  },

  /** POST /api/schedules */
  createSchedule(payload) {
    return request('/api/schedules', json(payload), () => mock.createSchedule(payload));
  },

  /** PATCH /api/schedules/{id} — used for pending → completed. */
  updateSchedule(scheduleId, patch) {
    return request(`/api/schedules/${scheduleId}`, { method: 'PATCH', body: JSON.stringify(patch) }, () =>
      mock.updateSchedule(scheduleId, patch)
    );
  },

  /** POST /api/conflicts/resolve — keep_both | replace_existing | edit_new_item | discard_new */
  resolveConflict({ conflictId, resolution }) {
    return request('/api/conflicts/resolve', json({ conflict_id: conflictId, resolution }), () =>
      mock.resolveConflict({ conflict_id: conflictId, resolution })
    );
  },

  /** POST /api/handoffs/generate — runs the Handoff Summary Agent. */
  generateHandoff({ careRecipientId = 'recipient_001', from, to, nextCaregiverId }) {
    const body = {
      care_recipient_id: careRecipientId,
      from,
      to,
      next_caregiver_id: nextCaregiverId,
    };
    return request('/api/handoffs/generate', json(body), () =>
      mock.generateHandoff({ from, to, next_caregiver_id: nextCaregiverId })
    );
  },

  /** POST /api/attachments (multipart). `uploadedBy` is a required form field
   *  on the backend — omitting it fails the whole upload with a 422. */
  async uploadAttachment(file, uploadedBy) {
    const form = new FormData();
    form.append('file', file);
    form.append('uploaded_by', uploadedBy || 'caregiver_amy');
    const uploaded = await request('/api/attachments', { method: 'POST', body: form }, () =>
      mock.uploadAttachment(file)
    );
    if (uploaded?.attachment_id) {
      attachmentRegistry.set(uploaded.attachment_id, {
        ...uploaded,
        file_name: uploaded.file_name || file.name,
        type: uploaded.type || (file.type.startsWith('image/') ? 'image' : 'file'),
      });
    }
    return uploaded;
  },

  /** Demo-only: plants the physiotherapy 2 PM vs 3 PM conflict. Mock path only. */
  seedDemoConflict() {
    return mock.seedDemoConflict();
  },
};

export { toDateKey, toLocalISO };
