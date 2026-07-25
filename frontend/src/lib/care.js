/** Display + time helpers shared by the Chat page, the Care Board and the mock backend. */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** ISO 8601 with the browser's local offset, e.g. 2026-07-24T08:30:00+08:00 */
export function toLocalISO(date) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** yyyy-mm-dd in local time. Never use toISOString() for this: it shifts the day. */
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const CATEGORY_META = {
  nutrition: { label: 'Nutrition', icon: '🍚', tone: 'green' },
  hydration: { label: 'Hydration', icon: '💧', tone: 'blue' },
  activity: { label: 'Activity', icon: '🚶', tone: 'teal' },
  medication: { label: 'Medication', icon: '💊', tone: 'violet' },
  symptom: { label: 'Symptom', icon: '🌡️', tone: 'red' },
  emotion: { label: 'Condition', icon: '🫀', tone: 'amber' },
  vital_sign: { label: 'Vital sign', icon: '📈', tone: 'red' },
  appointment: { label: 'Appointment', icon: '📅', tone: 'violet' },
  general_note: { label: 'Note', icon: '📝', tone: 'grey' },
};

export function categoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.general_note;
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatClock(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDateLong(dateKey) {
  const d = dateKey instanceof Date ? dateKey : new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const key = (x) => x.toDateString();
  if (key(d) === key(today)) return 'Today';
  if (key(d) === key(tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Half a bowl · Porridge" from a details_json object. */
export function describeDetails(details) {
  if (!details) return '';
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => (k === 'note' ? String(v) : `${labelise(k)}: ${v}`))
    .join(' · ');
}

export function labelise(key) {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function caregiverName(caregivers, id, fallback = 'Unknown') {
  return caregivers?.find((c) => c.id === id)?.name || fallback;
}

export function initials(name = '') {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

/** yyyy-mm-dd shifted by N days. */
export function shiftDateKey(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}
