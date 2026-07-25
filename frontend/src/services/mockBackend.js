/**
 * In-memory stand-in for the FastAPI backend.
 *
 * Purpose: the Chat page and Care Board stay demoable with no Python backend and
 * no API key. Every function here mirrors one real endpoint and returns the same
 * response shape, so swapping to the live backend changes nothing in the
 * components.
 *
 * The "AI" here is deliberately dumb keyword matching. It only exists so the UI
 * has something to render; the real intent + extraction comes from the
 * Conversation Agent.
 */

// ---------------------------------------------------------------- time utils

import { toDateKey, toLocalISO } from '../lib/care.js';

function at(dayOffset, hours, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return toLocalISO(d);
}

function sameDay(iso, dateKey) {
  return toDateKey(new Date(iso)) === dateKey;
}

// ----------------------------------------------------------------- seed data

const caregivers = [
  { id: 'caregiver_amy', name: 'Amy', relationship: 'Daughter' },
  { id: 'caregiver_ben', name: 'Ben', relationship: 'Son' },
  { id: 'caregiver_carol', name: 'Carol', relationship: 'Care worker' },
];

const careRecipient = {
  id: 'recipient_001',
  name: 'Dad',
  full_name: 'Mr. Lim Wei Ming',
  age: 78,
  notes: 'Hypertension, mild mobility difficulty',
};

let idCounter = 100;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}_${String(idCounter).padStart(3, '0')}`;
}

let events = [
  {
    id: 'event_001',
    care_recipient_id: 'recipient_001',
    caregiver_id: 'caregiver_amy',
    category: 'nutrition',
    event_time: at(0, 8, 30),
    title: 'Breakfast',
    details_json: { food: 'Porridge', amount: 'Half a bowl' },
    status: 'completed',
    source_type: 'text',
    raw_input: 'Dad ate half a bowl of porridge at 8:30.',
    attachment_id: null,
    confirmed_by_user: true,
    created_at: at(0, 8, 35),
  },
  {
    id: 'event_002',
    care_recipient_id: 'recipient_001',
    caregiver_id: 'caregiver_amy',
    category: 'medication',
    event_time: at(0, 9, 0),
    title: 'Morning blood pressure tablet',
    details_json: { medication_name: 'Amlodipine', dose: '5 mg' },
    status: 'completed',
    source_type: 'text',
    raw_input: 'Gave him the amlodipine 5mg after breakfast.',
    attachment_id: null,
    confirmed_by_user: true,
    created_at: at(0, 9, 5),
  },
  {
    id: 'event_003',
    care_recipient_id: 'recipient_001',
    caregiver_id: 'caregiver_amy',
    category: 'vital_sign',
    event_time: at(0, 9, 20),
    title: 'Blood pressure',
    details_json: { systolic: 142, diastolic: 88, unit: 'mmHg' },
    status: 'completed',
    source_type: 'text',
    raw_input: 'BP this morning was 142 over 88.',
    attachment_id: null,
    confirmed_by_user: true,
    created_at: at(0, 9, 22),
  },
  {
    id: 'event_004',
    care_recipient_id: 'recipient_001',
    caregiver_id: 'caregiver_amy',
    category: 'hydration',
    event_time: at(0, 12, 0),
    title: 'Water',
    details_json: { amount: 'One glass' },
    status: 'completed',
    source_type: 'text',
    raw_input: 'Dad drank one glass of water at noon.',
    attachment_id: null,
    confirmed_by_user: true,
    created_at: at(0, 12, 5),
  },
  {
    id: 'event_005',
    care_recipient_id: 'recipient_001',
    caregiver_id: 'caregiver_carol',
    category: 'activity',
    event_time: at(0, 13, 15),
    title: 'Short walk in the corridor',
    details_json: { duration: '10 minutes', assistance: 'Walking frame' },
    status: 'completed',
    source_type: 'voice',
    raw_input: 'Took him for a ten minute walk with the frame.',
    attachment_id: null,
    confirmed_by_user: true,
    created_at: at(0, 13, 20),
  },
  {
    id: 'event_006',
    care_recipient_id: 'recipient_001',
    caregiver_id: 'caregiver_carol',
    category: 'emotion',
    event_time: at(0, 13, 40),
    title: 'Appeared more tired than usual',
    details_json: { observation: 'Wanted to lie down right after the walk' },
    status: 'noted',
    source_type: 'text',
    raw_input: 'He seemed more tired than usual after the walk.',
    attachment_id: null,
    confirmed_by_user: true,
    created_at: at(0, 13, 45),
  },
];

let schedules = [
  {
    id: 'schedule_001',
    care_recipient_id: 'recipient_001',
    title: 'Afternoon medication',
    start_time: at(0, 15, 0),
    end_time: at(0, 15, 15),
    assigned_caregiver_id: 'caregiver_ben',
    status: 'pending',
    notes: 'Metformin 500 mg with food',
    created_by: 'caregiver_amy',
  },
  {
    id: 'schedule_002',
    care_recipient_id: 'recipient_001',
    title: 'Physiotherapy',
    start_time: at(1, 14, 0),
    end_time: at(1, 15, 0),
    assigned_caregiver_id: 'caregiver_ben',
    status: 'pending',
    notes: 'Bring the previous medical report',
    created_by: 'caregiver_amy',
  },
  {
    id: 'schedule_003',
    care_recipient_id: 'recipient_001',
    title: 'Dinner',
    start_time: at(0, 18, 30),
    end_time: at(0, 19, 0),
    assigned_caregiver_id: 'caregiver_ben',
    status: 'pending',
    notes: 'Low salt',
    created_by: 'caregiver_amy',
  },
];

let conflicts = [];
let attachments = [];

const shift = {
  current_caregiver_id: 'caregiver_amy',
  next_caregiver_id: 'caregiver_ben',
  shift_ends: at(0, 18, 0),
};

// --------------------------------------------------------------- tiny helper

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));

function caregiverById(id) {
  return caregivers.find((c) => c.id === id) || null;
}

// ------------------------------------------------- naive intent "extraction"

const CATEGORY_KEYWORDS = [
  ['medication', ['medicine', 'medication', 'tablet', 'pill', 'dose', 'mg', '药', '吃药']],
  ['vital_sign', ['blood pressure', 'bp ', 'temperature', 'fever', 'sugar', 'pulse', '血压', '体温']],
  ['hydration', ['water', 'drank', 'drink', 'juice', 'tea', 'fluids', '喝', '水']],
  ['nutrition', ['ate', 'eat', 'breakfast', 'lunch', 'dinner', 'porridge', 'soup', 'rice', 'meal', '吃', '饭', '粥']],
  ['activity', ['walk', 'walked', 'exercise', 'physio', 'stretch', 'shower', 'bath', '散步', '走路', '洗澡']],
  ['symptom', ['pain', 'cough', 'dizzy', 'vomit', 'swollen', 'sore', 'breath', '疼', '痛', '咳']],
  ['emotion', ['tired', 'sad', 'anxious', 'happy', 'confused', 'restless', 'mood', '累', '开心', '难过']],
  ['appointment', ['appointment', 'clinic', 'doctor', 'hospital', 'review', '预约', '复诊']],
];

const SCHEDULE_HINTS = [
  'tomorrow',
  'next week',
  'schedule',
  'appointment',
  'will ',
  'needs to',
  'has to',
  'remind',
  '明天',
  '预约',
  '要去',
];

function detectCategory(text) {
  for (const [category, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return category;
  }
  return 'general_note';
}

/** Pull "3pm", "15:00", "8.30am", "at noon" out of free text. Returns {hours, minutes} or null. */
function detectTime(text) {
  if (/\bnoon\b|中午/.test(text)) return { hours: 12, minutes: 0 };
  if (/\bmidnight\b/.test(text)) return { hours: 0, minutes: 0 };

  const withMinutes = text.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/);
  if (withMinutes) {
    let h = Number(withMinutes[1]);
    const m = Number(withMinutes[2]);
    const mer = withMinutes[3];
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    if (!mer && h < 7) h += 12; // "at 3" in a care log almost always means the afternoon
    return { hours: h, minutes: m };
  }

  const hourOnly = text.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (hourOnly) {
    let h = Number(hourOnly[1]);
    if (hourOnly[2] === 'pm' && h < 12) h += 12;
    if (hourOnly[2] === 'am' && h === 12) h = 0;
    return { hours: h, minutes: 0 };
  }
  return null;
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mealByHour(hour) {
  if (hour < 11) return 'Breakfast';
  if (hour < 16) return 'Lunch';
  return 'Dinner';
}

function guessTitle(text, category, hour) {
  const map = {
    nutrition: /breakfast|早/.test(text)
      ? 'Breakfast'
      : /lunch|午/.test(text)
        ? 'Lunch'
        : /dinner|晚/.test(text)
          ? 'Dinner'
          : mealByHour(hour),
    hydration: 'Water',
    medication: 'Medication',
    activity: /physio/.test(text) ? 'Physiotherapy' : 'Activity',
    symptom: 'Symptom reported',
    emotion: 'Condition observation',
    vital_sign: 'Vital sign',
    appointment: 'Appointment',
    general_note: 'Care note',
  };
  return map[category] || 'Care note';
}

/**
 * Mirrors the Conversation Agent's structured output contract.
 * Real version comes from the backend conversation agent; this is keyword matching only.
 */
function fakeConversationAgent(message, clientTime) {
  const text = message.toLowerCase();
  const now = clientTime ? new Date(clientTime) : new Date();
  const category = detectCategory(text);
  const time = detectTime(text);
  const isSchedule = SCHEDULE_HINTS.some((h) => text.includes(h)) && !/\b(ate|drank|gave|took|did)\b/.test(text);

  // Clarification: medication mentioned but not named.
  // The generic words are stripped first, otherwise "medicine" itself matches the drug-name pattern.
  const drugProbe = text.replace(/medicines?|medications?|tablets?|pills?|药/g, ' ');
  const namesADrug = /\b[a-z]{5,}(ol|ine|pam|cin|zole|formin|pril|statin)\b/.test(drugProbe) || /\d+\s?mg\b/.test(text);
  if (category === 'medication' && !isSchedule && !namesADrug) {
    return {
      intent: 'record_care_event',
      assistant_reply: 'Which medication did he take?',
      needs_clarification: true,
      clarification_question: 'Which medication did he take?',
      missing_fields: ['medication_name'],
      care_events: [],
      schedule_item: null,
      requested_action: 'ask_clarification',
    };
  }

  if (isSchedule) {
    const day = /tomorrow|明天/.test(text) ? 1 : 0;
    const start = new Date(now);
    start.setDate(start.getDate() + day);
    start.setHours(time ? time.hours : 15, time ? time.minutes : 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const title = /physio/.test(text)
      ? 'Physiotherapy'
      : /doctor|clinic|hospital|复诊/.test(text)
        ? 'Doctor appointment'
        : titleCase(message.trim().split(/[.,;]/)[0].slice(0, 40));

    return {
      intent: 'create_schedule',
      assistant_reply: `I understood this as a new scheduled task: ${title}.`,
      needs_clarification: false,
      clarification_question: null,
      missing_fields: [],
      care_events: [],
      schedule_item: {
        title,
        start_time: toLocalISO(start),
        end_time: toLocalISO(end),
        notes: null,
      },
      requested_action: 'create_schedule',
    };
  }

  if (/timeline|what happened|summary of today|今天/.test(text) && !time) {
    return {
      intent: 'view_timeline',
      assistant_reply: "Here is today's timeline on the Care Board.",
      needs_clarification: false,
      clarification_question: null,
      missing_fields: [],
      care_events: [],
      schedule_item: null,
      requested_action: 'view_timeline',
    };
  }

  if (/handoff|hand over|shift/.test(text)) {
    return {
      intent: 'generate_handoff',
      assistant_reply: 'I can generate a handoff summary from the Care Board.',
      needs_clarification: false,
      clarification_question: null,
      missing_fields: [],
      care_events: [],
      schedule_item: null,
      requested_action: 'generate_handoff',
    };
  }

  const eventTime = new Date(now);
  if (time) eventTime.setHours(time.hours, time.minutes, 0, 0);

  const details = {};
  const amount = message.match(/\b(half a bowl|one glass|two glasses|a bowl|a cup|\d+\s?(ml|mg|glasses|bowls|minutes))\b/i);
  if (amount) details.amount = titleCase(amount[0]);
  const food = message.match(/\b(porridge|rice|soup|noodles|bread|fruit|egg[s]?)\b/i);
  if (food) details.food = titleCase(food[0]);
  if (!Object.keys(details).length) details.note = message.trim();

  return {
    intent: 'record_care_event',
    assistant_reply: `I understood this as a ${category.replace('_', ' ')} update.`,
    needs_clarification: false,
    clarification_question: null,
    missing_fields: [],
    care_events: [
      {
        category,
        event_time: toLocalISO(eventTime),
        title: guessTitle(text, category, eventTime.getHours()),
        details,
        status: 'completed',
      },
    ],
    schedule_item: null,
    requested_action: 'create_care_event',
  };
}

// ---------------------------------------------------------- conflict engine

function findScheduleConflicts(candidate, ignoreId = null) {
  const newStart = new Date(candidate.start_time).getTime();
  const newEnd = new Date(candidate.end_time || candidate.start_time).getTime() + (candidate.end_time ? 0 : 30 * 60 * 1000);

  return schedules
    .filter((s) => s.id !== ignoreId && s.care_recipient_id === candidate.care_recipient_id)
    .filter((s) => {
      const start = new Date(s.start_time).getTime();
      const end = new Date(s.end_time || s.start_time).getTime() + (s.end_time ? 0 : 30 * 60 * 1000);
      const overlaps = newStart < end && newEnd > start;
      const sameTitleSameDay =
        s.title.trim().toLowerCase() === String(candidate.title).trim().toLowerCase() &&
        toDateKey(new Date(s.start_time)) === toDateKey(new Date(candidate.start_time));
      return overlaps || sameTitleSameDay;
    })
    .map((s) => ({
      id: nextId('conflict'),
      type:
        s.title.trim().toLowerCase() === String(candidate.title).trim().toLowerCase()
          ? 'possible_duplicate'
          : 'schedule_overlap',
      existing_schedule_id: s.id,
      existing: { title: s.title, start_time: s.start_time },
      incoming: { title: candidate.title, start_time: candidate.start_time },
      message:
        s.title.trim().toLowerCase() === String(candidate.title).trim().toLowerCase()
          ? `${s.title} is already recorded at ${new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`
          : `${s.title} overlaps this new task.`,
      resolution_options: ['keep_both', 'replace_existing', 'edit_new_item'],
      status: 'open',
    }));
}

// ------------------------------------------------------------- api surface

export const mock = {
  async getBootstrap() {
    await delay(120);
    return { care_recipient: careRecipient, caregivers, shift };
  },

  async getCareBoard({ date }) {
    await delay();
    const dateKey = date || toDateKey(new Date());
    const dayEvents = events
      .filter((e) => sameDay(e.event_time, dateKey))
      .sort((a, b) => new Date(a.event_time) - new Date(b.event_time))
      // The Care Board needs a URL, not just an id, to show the photo.
      .map((e) => (e.attachment_id ? { ...e, attachment: attachments.find((a) => a.attachment_id === e.attachment_id) || null } : e));

    // Upcoming list intentionally shows today + the next days, like the Care Board sketch.
    const upcoming = schedules
      .filter((s) => new Date(s.start_time) >= new Date(`${dateKey}T00:00:00`))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    return {
      date: dateKey,
      care_recipient: careRecipient,
      events: dayEvents,
      schedule_items: upcoming,
      conflicts: conflicts.filter((c) => c.status === 'open'),
      caregivers,
      current_caregiver: caregiverById(shift.current_caregiver_id),
      next_caregiver: caregiverById(shift.next_caregiver_id),
      shift_ends: shift.shift_ends,
    };
  },

  async sendChat({ caregiver_id, message, client_time, attachment_ids = [] }) {
    await delay(520);
    const structured = fakeConversationAgent(message, client_time);
    const createdEvents = [];
    let newConflicts = [];
    let createdScheduleId = null;

    if (structured.requested_action === 'create_care_event') {
      for (const draft of structured.care_events) {
        const event = {
          id: nextId('event'),
          care_recipient_id: careRecipient.id,
          caregiver_id,
          category: draft.category,
          event_time: draft.event_time,
          title: draft.title,
          details_json: draft.details || {},
          status: draft.status || 'completed',
          source_type: attachment_ids.length ? 'image' : 'text',
          raw_input: message,
          attachment_id: attachment_ids[0] || null,
          confirmed_by_user: true,
          created_at: toLocalISO(new Date()),
        };
        events.push(event);
        createdEvents.push(event);
      }
    }

    if (structured.requested_action === 'create_schedule' && structured.schedule_item) {
      const candidate = {
        ...structured.schedule_item,
        care_recipient_id: careRecipient.id,
      };
      newConflicts = findScheduleConflicts(candidate);
      const item = {
        id: nextId('schedule'),
        care_recipient_id: careRecipient.id,
        title: candidate.title,
        start_time: candidate.start_time,
        end_time: candidate.end_time,
        assigned_caregiver_id: shift.next_caregiver_id,
        status: 'pending',
        notes: candidate.notes || null,
        created_by: caregiver_id,
      };
      schedules.push(item);
      createdScheduleId = item.id;
      newConflicts.forEach((c) => {
        c.incoming_schedule_id = item.id;
        conflicts.push(c);
      });
    }

    return {
      status: structured.needs_clarification ? 'clarification_required' : 'saved',
      assistant_message: structured.assistant_reply,
      structured,
      created_events: createdEvents,
      created_event_ids: createdEvents.map((e) => e.id),
      created_schedule_id: createdScheduleId,
      clarification_required: structured.needs_clarification,
      conflicts: newConflicts,
    };
  },

  async createEvent(payload) {
    await delay();
    const event = {
      id: nextId('event'),
      care_recipient_id: careRecipient.id,
      status: 'completed',
      source_type: 'manual',
      details_json: {},
      confirmed_by_user: true,
      created_at: toLocalISO(new Date()),
      ...payload,
    };
    events.push(event);
    return event;
  },

  async updateEvent(eventId, patch) {
    await delay(180);
    const event = events.find((e) => e.id === eventId);
    if (!event) throw new Error(`Unknown event ${eventId}`);
    Object.assign(event, patch, { confirmed_by_user: true });
    return event;
  },

  async createSchedule(payload) {
    await delay();
    const candidate = { ...payload, care_recipient_id: careRecipient.id };
    const found = findScheduleConflicts(candidate);
    const item = {
      id: nextId('schedule'),
      care_recipient_id: careRecipient.id,
      assigned_caregiver_id: payload.assigned_caregiver_id || shift.next_caregiver_id,
      status: 'pending',
      notes: payload.notes || null,
      end_time: payload.end_time || null,
      ...payload,
    };
    schedules.push(item);
    found.forEach((c) => {
      c.incoming_schedule_id = item.id;
      conflicts.push(c);
    });
    return found.length
      ? { status: 'confirmation_required', schedule_item_id: item.id, conflicts: found, resolution_options: ['keep_both', 'replace_existing', 'edit_new_item'] }
      : { status: 'created', schedule_item_id: item.id, conflicts: [] };
  },

  async updateSchedule(scheduleId, patch) {
    await delay(180);
    const item = schedules.find((s) => s.id === scheduleId);
    if (!item) throw new Error(`Unknown schedule ${scheduleId}`);
    Object.assign(item, patch);
    return item;
  },

  async resolveConflict({ conflict_id, resolution }) {
    await delay(220);
    const conflict = conflicts.find((c) => c.id === conflict_id);
    if (!conflict) throw new Error(`Unknown conflict ${conflict_id}`);
    conflict.status = 'resolved';
    conflict.resolution = resolution;

    if (resolution === 'replace_existing') {
      schedules = schedules.filter((s) => s.id !== conflict.existing_schedule_id);
    }
    if (resolution === 'discard_new' && conflict.incoming_schedule_id) {
      schedules = schedules.filter((s) => s.id !== conflict.incoming_schedule_id);
    }
    return { status: 'resolved', conflict_id, resolution };
  },

  async generateHandoff({ from, to, next_caregiver_id }) {
    await delay(700);
    const start = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = to ? new Date(to) : new Date(new Date().setHours(23, 59, 59, 999));
    const now = new Date();

    const inRange = events
      .filter((e) => {
        const t = new Date(e.event_time);
        return t >= start && t <= end;
      })
      .sort((a, b) => new Date(a.event_time) - new Date(b.event_time));

    // Summary text is written the way the backend would write it: fixed English, 24-hour clock.
    const clock = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const completed = inRange
      .filter((e) => e.status === 'completed')
      .map((e) => ({
        text: `${e.title}${e.details_json?.amount ? ` (${e.details_json.amount})` : ''} recorded at ${clock(e.event_time)} by ${caregiverById(e.caregiver_id)?.name || 'a caregiver'}.`,
        event_ids: [e.id],
      }));

    const conditionChanges = inRange
      .filter((e) => ['emotion', 'symptom', 'vital_sign'].includes(e.category))
      .map((e) => {
        const d = e.details_json || {};
        const reading =
          d.systolic && d.diastolic
            ? ` — ${d.systolic}/${d.diastolic} ${d.unit || ''}`.trimEnd()
            : d.observation
              ? ` — ${d.observation}`
              : '';
        return {
          text: `${caregiverById(e.caregiver_id)?.name || 'A caregiver'} reported: ${e.title.toLowerCase()}${reading}.`,
          event_ids: [e.id],
        };
      });

    const overdue = schedules
      .filter((s) => s.status === 'pending' && new Date(s.start_time) < now && new Date(s.start_time) >= start)
      .map((s) => ({
        text: `No completion record has been submitted for "${s.title}" scheduled at ${clock(s.start_time)}.`,
        schedule_ids: [s.id],
      }));

    const categoriesToday = new Set(inRange.map((e) => e.category));
    const gaps = [];
    if (!inRange.some((e) => e.category === 'nutrition' && new Date(e.event_time).getHours() >= 11 && new Date(e.event_time).getHours() <= 15) && now.getHours() >= 14) {
      gaps.push({ text: 'No lunch update has been recorded for today.', event_ids: [] });
    }
    if (!categoriesToday.has('hydration') && now.getHours() >= 12) {
      gaps.push({ text: 'No hydration update has been recorded today.', event_ids: [] });
    }

    const upcoming = schedules
      .filter((s) => new Date(s.start_time) >= now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
      .slice(0, 5)
      .map((s) => {
        const d = new Date(s.start_time);
        const isToday = toDateKey(d) === toDateKey(now);
        const when = `${isToday ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'long' })} at ${clock(s.start_time)}`;
        return { text: `${s.title} — ${when}.`, schedule_ids: [s.id] };
      });

    return {
      generated_at: toLocalISO(new Date()),
      from: toLocalISO(start),
      to: toLocalISO(end),
      from_caregiver: caregiverById(shift.current_caregiver_id),
      next_caregiver: caregiverById(next_caregiver_id || shift.next_caregiver_id),
      completed,
      needs_attention: [...overdue, ...gaps],
      condition_changes: conditionChanges,
      upcoming,
      conflicts: conflicts
        .filter((c) => c.status === 'open')
        .map((c) => ({ text: c.message, conflict_ids: [c.id] })),
      unconfirmed_information: events
        .filter((e) => !e.confirmed_by_user)
        .map((e) => ({ text: `${e.title} has not been confirmed by a caregiver.`, event_ids: [e.id] })),
    };
  },

  async uploadAttachment(file) {
    await delay(300);
    const attachment = {
      attachment_id: nextId('attachment'),
      type: file.type.startsWith('image/') ? 'image' : 'file',
      file_url: URL.createObjectURL(file),
      file_name: file.name,
      uploaded_at: toLocalISO(new Date()),
    };
    attachments.push(attachment);
    return attachment;
  },

  /** Demo helper: plants the "physio at 2pm vs 3pm" conflict from the pitch script. */
  async seedDemoConflict() {
    await delay(200);
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(15, 0, 0, 0);
    return this.createSchedule({
      title: 'Physiotherapy',
      start_time: toLocalISO(start),
      end_time: toLocalISO(new Date(start.getTime() + 60 * 60 * 1000)),
      created_by: 'caregiver_ben',
      notes: 'Ben logged a different time for the same session',
    });
  },
};

export { caregivers, careRecipient, toDateKey, toLocalISO };
