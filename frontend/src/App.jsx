import { useCallback, useEffect, useMemo, useState } from 'react';
import CareRecipientHeader from './components/CareRecipientHeader.jsx';
import CaregiverSelector from './components/CaregiverSelector.jsx';
import CareBoardPage from './pages/CareBoardPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import { api, getMode, onModeChange, toLocalISO } from './services/api.js';
import { caregiverName, formatClock, toDateKey } from './lib/care.js';

// Home is not a tab: it is the entry screen on load, reachable again through the brand logo.
const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'board', label: 'Care Board' },
];

const THREADS_KEY = 'careRelay.threads';

/**
 * One conversation per caregiver. The care board is shared — every event carries a
 * caregiver_id and the mock/API store is global — but Amy and Ben each keep their own
 * chat, which is the point of the product: private updates, one common timeline.
 */
function newThread(caregiverId, name) {
  return {
    messages: [
      {
        key: `m0_${caregiverId}`,
        role: 'assistant',
        type: 'text',
        text: `Hi${name ? ` ${name}` : ''} — tell me what happened with your care recipient. I will record it on the shared care board and flag anything that clashes with the schedule.`,
        time: toLocalISO(new Date()),
      },
    ],
    input: '',
    attachment: null,
    conversationId: `conversation_${caregiverId}_${Date.now()}`,
    // Watermark for the "while you were away" note. Starts at now, so opening a
    // thread for the first time never dumps the whole day into it.
    lastSeenAt: toLocalISO(new Date()),
  };
}

const recordedAt = (event) => event.created_at || event.event_time;

function loadThreads() {
  try {
    return JSON.parse(localStorage.getItem(THREADS_KEY)) || {};
  } catch {
    return {};
  }
}

/**
 * What survives a reload is deliberately trimmed: blob: URLs for photos die with the
 * page, and Confirm/Edit cards point at event ids the mock backend re-seeds away, so
 * only the plain conversation is kept.
 */
function saveThreads(threads) {
  const keepable = {};
  for (const [id, thread] of Object.entries(threads)) {
    keepable[id] = {
      ...thread,
      attachment: null,
      messages: thread.messages
        .filter((m) => !m.pending && m.type !== 'preview' && m.type !== 'conflict' && m.type !== 'system')
        .map((m) => (m.attachment ? { ...m, attachment: { ...m.attachment, file_url: null } } : m)),
    };
  }
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(keepable));
  } catch {
    /* quota or private mode — the in-memory threads still work */
  }
}

export default function App() {
  const [tab, setTab] = useState('home');
  // Leaving the landing page plays a fade-out first; this holds the page we are
  // heading to until that animation reports back.
  const [leavingTo, setLeavingTo] = useState(null);

  // Chat state lives here, not inside ChatPage: switching tabs unmounts the page,
  // and local state would go with it — the conversation must survive that.
  const [threads, setThreads] = useState(loadThreads);
  const [bootstrap, setBootstrap] = useState(null);
  const [caregiverId, setCaregiverId] = useState(() => localStorage.getItem('careRelay.caregiverId') || '');
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [board, setBoard] = useState(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [mode, setMode] = useState(getMode());
  const [fatal, setFatal] = useState(null);

  useEffect(() => onModeChange(setMode), []);

  useEffect(() => {
    api
      .getBootstrap()
      .then((data) => {
        setBootstrap(data);
        setCaregiverId((current) => current || data.shift?.current_caregiver_id || data.caregivers?.[0]?.id || '');
      })
      .catch((err) => setFatal(`Could not load caregivers: ${err.message}`));
  }, []);

  useEffect(() => {
    if (caregiverId) localStorage.setItem('careRelay.caregiverId', caregiverId);
  }, [caregiverId]);

  const loadBoard = useCallback(async () => {
    setLoadingBoard(true);
    try {
      const data = await api.getCareBoard({ careRecipientId: bootstrap?.care_recipient?.id, date });
      setBoard(data);
    } catch (err) {
      setFatal(`Could not load the care board: ${err.message}`);
    } finally {
      setLoadingBoard(false);
    }
  }, [bootstrap?.care_recipient?.id, date]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const recipient = board?.care_recipient || bootstrap?.care_recipient;
  const caregivers = board?.caregivers || bootstrap?.caregivers || [];

  // The handoff summary lives here for the same reason the chat does: opening the
  // Chat tab unmounts CareBoardPage, and a summary the user waited on must survive
  // that. It is tagged with the day it covers, so moving the date picker does not
  // leave yesterday's summary sitting under today's timeline.
  const [handoff, setHandoff] = useState(null);
  const [generatingHandoff, setGeneratingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState(null);

  const generateHandoff = useCallback(async () => {
    setGeneratingHandoff(true);
    setHandoffError(null);
    try {
      const from = new Date(`${date}T00:00:00`);
      const to = board?.shift_ends ? new Date(board.shift_ends) : new Date(`${date}T23:59:59`);
      const result = await api.generateHandoff({
        careRecipientId: board?.care_recipient?.id,
        from: toLocalISO(from),
        to: toLocalISO(to),
        nextCaregiverId: board?.next_caregiver?.id,
      });
      setHandoff({ date, data: result });
    } catch (err) {
      setHandoffError(`Handoff could not be generated: ${err.message}`);
    } finally {
      setGeneratingHandoff(false);
    }
  }, [board, date]);

  const openPage = useCallback(
    (next) => {
      if (next === tab || leavingTo) return;
      if (tab === 'home') setLeavingTo(next);
      else setTab(next);
    },
    [tab, leavingTo]
  );

  const finishLeaving = useCallback(() => {
    setLeavingTo((next) => {
      if (next) setTab(next);
      return null;
    });
  }, []);

  // Safety net: if the animation never fires an end event (reduced motion, a
  // background tab), do not strand the user on the landing page.
  useEffect(() => {
    if (!leavingTo) return undefined;
    const timer = setTimeout(finishLeaving, 700);
    return () => clearTimeout(timer);
  }, [leavingTo, finishLeaving]);

  // Open a thread the first time a caregiver is selected, greeting them by name.
  useEffect(() => {
    if (!caregiverId || !caregivers.length) return; // wait for names, so the greeting can use one
    setThreads((prev) =>
      prev[caregiverId] ? prev : { ...prev, [caregiverId]: newThread(caregiverId, caregiverName(caregivers, caregiverId, '')) }
    );
  }, [caregiverId, caregivers]);

  useEffect(() => {
    if (Object.keys(threads).length) saveThreads(threads);
  }, [threads]);

  /**
   * Catch-up note: what the others put on the shared board while this person was
   * writing in a different thread. Makes the "one board, separate chats" model
   * visible from inside the chat, not only on the Care Board.
   */
  useEffect(() => {
    if (tab !== 'chat' || !caregiverId || !board?.events) return;
    const seenAt = threads[caregiverId]?.lastSeenAt;
    if (!seenAt) return;

    // `<= now` drops seed rows whose timestamps sit later today than the current clock —
    // without it, opening a thread before 08:30 reports the demo data as breaking news.
    const seen = new Date(seenAt);
    const now = new Date();
    const missed = board.events.filter((e) => {
      if (e.caregiver_id === caregiverId) return false;
      const at = new Date(recordedAt(e));
      return at > seen && at <= now;
    });
    if (!missed.length) return;

    const lines = missed
      .slice(0, 3)
      .map((e) => `${caregiverName(caregivers, e.caregiver_id, 'Someone')} recorded ${e.title} at ${formatClock(e.event_time)}`);
    const more = missed.length - lines.length;

    setThreads((prev) => {
      const current = prev[caregiverId];
      if (!current) return prev;
      return {
        ...prev,
        [caregiverId]: {
          ...current,
          lastSeenAt: toLocalISO(new Date()),
          messages: [
            ...current.messages,
            {
              key: `sys_${Date.now()}`,
              role: 'assistant',
              type: 'system',
              text: `While you were away · ${lines.join(' · ')}${more > 0 ? ` · and ${more} more` : ''}`,
              time: toLocalISO(new Date()),
            },
          ],
        },
      };
    });
  }, [tab, caregiverId, board, caregivers, threads]);

  const thread = threads[caregiverId];

  /** Every chat setter writes into the active caregiver's thread only. */
  const patchThread = useCallback(
    (patch) => {
      if (!caregiverId) return;
      setThreads((prev) => {
        const current = prev[caregiverId] || newThread(caregiverId, '');
        const next = typeof patch === 'function' ? patch(current) : patch;
        return { ...prev, [caregiverId]: { ...current, ...next } };
      });
    },
    [caregiverId]
  );

  const chatHandlers = useMemo(
    () => ({
      setMessages: (updater) =>
        patchThread((t) => ({ messages: typeof updater === 'function' ? updater(t.messages) : updater })),
      setInput: (value) => patchThread((t) => ({ input: typeof value === 'function' ? value(t.input) : value })),
      setAttachment: (value) =>
        patchThread((t) => ({ attachment: typeof value === 'function' ? value(t.attachment) : value })),
    }),
    [patchThread]
  );

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="topbar__brand"
          onClick={() => setTab('home')}
          aria-label="CareRelay home"
        >
          <span className="logo" aria-hidden="true">
            ⟳
          </span>
          <div>
            <strong>CareRelay</strong>
            <small>Shared care timeline &amp; handoff</small>
          </div>
        </button>

        {/* Identity belongs in the topbar, not inside Chat: the board acts as this
            person too (task author, assignee default), so it must stay visible there.
            Kept mounted on Home and only made invisible — removing it would resize the
            header and the whole frame would jump on the way into Chat. */}
        <div className={`topbar__identity ${tab === 'home' ? 'is-hidden' : ''}`} aria-hidden={tab === 'home'}>
          <CareRecipientHeader recipient={recipient} />
          {caregivers.length > 0 && (
            <CaregiverSelector
              caregivers={caregivers}
              value={caregiverId}
              onChange={setCaregiverId}
              className="caregiver-selector--topbar"
            />
          )}
        </div>

        <nav className="tabs" aria-label="Pages">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => openPage(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <span className={`mode ${mode === 'live' ? 'mode--live' : 'mode--mock'}`} title={
          mode === 'live' ? 'Connected to the FastAPI backend' : 'Backend not reachable — running on local demo data'
        }>
          {mode === 'live' ? 'Live backend' : 'Demo data'}
        </span>
      </header>

      {fatal && <div className="banner banner--error">{fatal}</div>}

      <main className="main">
        {tab === 'home' && <LandingPage onOpen={openPage} leaving={!!leavingTo} onLeft={finishLeaving} />}

        {tab === 'chat' && thread && (
          <ChatPage
            key={caregiverId}
            recipient={recipient}
            caregivers={caregivers}
            caregiverId={caregiverId}
            onDataChanged={loadBoard}
            messages={thread.messages}
            setMessages={chatHandlers.setMessages}
            input={thread.input}
            setInput={chatHandlers.setInput}
            attachment={thread.attachment}
            setAttachment={chatHandlers.setAttachment}
            conversationId={thread.conversationId}
          />
        )}

        {tab === 'board' && (
          <CareBoardPage
            board={board}
            loading={loadingBoard}
            date={date}
            caregiverId={caregiverId}
            onDateChange={setDate}
            onRefresh={loadBoard}
            isMock={mode !== 'live'}
            handoff={handoff?.date === date ? handoff.data : null}
            generatingHandoff={generatingHandoff}
            handoffError={handoffError}
            onGenerateHandoff={generateHandoff}
          />
        )}
      </main>
    </div>
  );
}
