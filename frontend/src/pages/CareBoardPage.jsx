import { useState } from 'react';
import AddTaskForm from '../components/AddTaskForm.jsx';
import ConflictAlert from '../components/ConflictAlert.jsx';
import DateSelector from '../components/DateSelector.jsx';
import HandoffCard from '../components/HandoffCard.jsx';
import ScheduleList from '../components/ScheduleList.jsx';
import ShiftHeader from '../components/ShiftHeader.jsx';
import Timeline from '../components/Timeline.jsx';
import { api } from '../services/api.js';
import { toDateKey } from '../lib/care.js';

/**
 * `handoff` and its loading/error state are owned by App, not by this page:
 * switching to the Chat tab unmounts CareBoardPage, so anything held in local
 * state here is gone when the user comes back.
 */
export default function CareBoardPage({
  board,
  loading,
  date,
  caregiverId,
  onDateChange,
  onRefresh,
  isMock,
  handoff,
  generatingHandoff,
  handoffError,
  onGenerateHandoff,
}) {
  const [highlightId, setHighlightId] = useState(null);
  const [busyConflict, setBusyConflict] = useState(null);
  const [addingTask, setAddingTask] = useState(false);

  const events = board?.events || [];
  const schedules = board?.schedule_items || [];
  const caregivers = board?.caregivers || [];
  const conflicts = board?.conflicts || [];
  const pending = schedules.filter((s) => s.status === 'pending');
  const overdue = pending.filter((s) => new Date(s.start_time) < new Date());

  async function toggleScheduleStatus(item, status) {
    await api.updateSchedule(item.id, { status });
    onRefresh?.();
  }

  /** Manual task entry. Goes through the same endpoint as the chat agent, so the
   *  conflict engine still runs and any clash shows up in the alerts panel. */
  async function addTask(fields) {
    await api.createSchedule({
      care_recipient_id: board?.care_recipient?.id || 'recipient_001',
      // The person selected in the topbar is the author — not whoever is on shift.
      created_by: caregiverId || board?.current_caregiver?.id || caregivers[0]?.id || 'caregiver_amy',
      status: 'pending',
      ...fields,
    });
    setAddingTask(false);
    onRefresh?.();
  }

  async function resolveConflict(conflict, resolution) {
    setBusyConflict(conflict.id);
    try {
      await api.resolveConflict({ conflictId: conflict.id, resolution });
      onRefresh?.();
    } finally {
      setBusyConflict(null);
    }
  }

  function traceEvent(eventId) {
    setHighlightId(eventId);
    document.getElementById(`event-${eventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightId(null), 2600);
  }

  async function plantDemoConflict() {
    await api.seedDemoConflict();
    onRefresh?.();
  }

  return (
    <div className="board">
      <div className="board__bar">
        <DateSelector value={date} onChange={onDateChange} />
        <div className="board__bar-actions">
          {isMock && (
            <button type="button" className="btn btn--ghost" onClick={plantDemoConflict} title="Adds a clashing physiotherapy entry">
              Plant demo conflict
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <ShiftHeader
        current={board?.current_caregiver}
        next={board?.next_caregiver}
        shiftEnds={board?.shift_ends}
        onGenerateHandoff={onGenerateHandoff}
        generating={generatingHandoff}
      />

      <div className="stats">
        <div className="stat">
          <strong>{events.length}</strong>
          <span>Recorded events</span>
        </div>
        <div className="stat">
          <strong>{pending.length}</strong>
          <span>Pending tasks</span>
        </div>
        <div className={`stat ${overdue.length ? 'stat--warn' : ''}`}>
          <strong>{overdue.length}</strong>
          <span>No completion record</span>
        </div>
        <div className={`stat ${conflicts.length ? 'stat--warn' : ''}`}>
          <strong>{conflicts.length}</strong>
          <span>Open conflicts</span>
        </div>
      </div>

      {conflicts.length > 0 && (
        <section className="panel panel--flush">
          <h2 className="panel__title">Conflict alerts</h2>
          <ConflictAlert conflicts={conflicts} onResolve={resolveConflict} busyId={busyConflict} />
        </section>
      )}

      {handoffError && <div className="banner banner--error">{handoffError}</div>}

      <div className="board__grid">
        <section className="panel">
          <h2 className="panel__title">
            Daily timeline
            {date !== toDateKey(new Date()) && <span className="badge">{date}</span>}
          </h2>
          {loading && !events.length ? (
            <div className="empty">
              <p>Loading…</p>
            </div>
          ) : (
            <Timeline
              events={events}
              caregivers={caregivers}
              highlightId={highlightId}
              emptyHint="Add one from the Chat page — it appears here immediately."
            />
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">
            Upcoming tasks
            {!addingTask && (
              <button type="button" className="btn btn--ghost panel__action" onClick={() => setAddingTask(true)}>
                + Add task
              </button>
            )}
          </h2>

          {addingTask && (
            <AddTaskForm
              caregivers={caregivers}
              defaultAssignee={caregiverId}
              onCreate={addTask}
              onCancel={() => setAddingTask(false)}
            />
          )}

          <ScheduleList items={schedules} caregivers={caregivers} onToggleStatus={toggleScheduleStatus} />
        </section>
      </div>

      {handoff && (
        <section className="panel panel--flush">
          <HandoffCard
            handoff={handoff}
            events={events}
            caregivers={caregivers}
            onTrace={traceEvent}
            onRegenerate={onGenerateHandoff}
          />
        </section>
      )}
    </div>
  );
}
