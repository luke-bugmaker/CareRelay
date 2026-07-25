# CareRelay

**CareRelay turns fragmented caregiver updates into a shared care timeline, flags schedule conflicts, and generates a traceable handoff summary for the next caregiver.**

When several people look after one person, the important details end up scattered across chat apps, voice notes, photos and memory. The next caregiver starts their shift not knowing what has already been done. CareRelay collects those updates in one place, keeps them structured, and turns the handoff into a single click.

---

## What it can do

### Write an update in plain language

Type or dictate what happened — *"Dad ate half a bowl of porridge at 8:30"* — and the AI turns it into a structured care record: category, time, title, details. Nothing is guessed silently: it shows you what it understood and waits for **Confirm** before saving anything.

Works in Chinese and mixed language, and keeps the caregiver's original sentence so the record stays auditable.

### Ask, rather than assume

When an update is missing something important, the assistant asks one short question instead of inventing a value. Report a symptom and it walks through a short intake — what, where, how severe, how long, how it started — before it records anything.

### Catch schedule clashes

Say *"Dad has physiotherapy tomorrow at 3 PM"* and CareRelay creates the appointment. If it overlaps something already booked, you get a conflict card with three choices: **Keep both**, **Replace existing**, **Discard new**. The overlap check is plain Python, not an AI judgement — it is deterministic and explainable.

### One board, separate conversations

Each caregiver has their own chat thread, but everyone writes to the same care board. Switch caregiver in the top bar and the conversation switches with it. When you come back, a short note tells you what the others recorded while you were away.

### See the whole day

The Care Board shows the daily timeline, upcoming tasks with pending/completed toggles, overdue highlighting, open conflicts, and any photos attached to an event.

### Hand over in one click

**Generate handoff** produces a summary for the next caregiver: what was completed, what still needs attention, what is coming up. Every line carries a **source** chip — click it to jump to the original timeline entry, hover it to read the caregiver's exact words. The summary can only reference records that exist in the database.

### Extras

- **Voice input** — browser dictation (Chrome / Edge)
- **Photo attachment** — attach an image as supporting evidence; it appears on the timeline
- **Manual entry** — *+ Add task* for anything you would rather type into a form than a chat
- **Offline demo mode** — the whole app runs with no backend at all, on built-in demo data

What it deliberately does **not** do: diagnose, recommend medication, or claim a task was missed. An empty record means *not recorded*, not *not done*.

---

## How it works

```text
React + Vite  (frontend/)
   │   Chat · Care Board · landing page
   │   falls back to in-browser demo data if the API is unreachable
   ▼
FastAPI  (backend/)
   │   validation · approval store · conflict engine · attachments
   ▼
AI provider  (any OpenAI-compatible /chat/completions endpoint)
   │   Conversation Agent → structured output
   │   Handoff Agent      → summarises database records only
   ▼
SQLite
```

The provider is config, not code. `backend/app/services/llm_client.py` speaks the
OpenAI chat-completions protocol, so OpenAI, DeepSeek, Qwen, Moonshot, OpenRouter
or a local Ollama/vLLM server are all a `.env` edit apart.

**The principle:** the model interprets language. Python owns every write, every time comparison, every conflict check and the audit trail. AI-proposed writes always pass through:

```text
model output → preview card → Confirm / Reject → database write
```

Pending approvals expire after 15 minutes and are held in memory, so restarting the backend discards them.

---

## Getting started

You need **Node.js 20+**. For the real backend you also need **Python 3.11+** (3.13 recommended) and an API key from any OpenAI-compatible provider.

### Option 1 — the app on its own, no backend

Fastest way to see it. No Python, no API key, no internet.

```powershell
cd CareRelay\frontend
Copy-Item .env.example .env.local
# put VITE_FORCE_MOCK=true in .env.local
npm install      # first time only, ~15 s
npm run dev
```

Open <http://localhost:5173>. The badge top-right reads **Demo data** — everything is clickable and runs on built-in sample data.

### Option 2 — the full stack with real AI

Two terminals.

**Terminal 1 — backend**

```powershell
cd CareRelay\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

**Terminal 2 — frontend**

```powershell
cd CareRelay\frontend
npm run dev
```

Open <http://localhost:5173>. The badge should now read **Live backend**.

Check <http://localhost:8000/health> — you want:

```json
{"status":"ok","ai_configured":true,"ai_model":"gpt-4o-mini"}
```

`ai_configured: false` means the AI is **not** connected; the app silently uses a small keyword parser and still looks like it works. Fix the configuration below rather than trusting the UI.

### Connecting an AI provider

Copy `.env.example` to `.env` (it is gitignored — your key never leaves your machine) and set three values:

```env
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Restart uvicorn afterwards; settings are read once at startup.

| Provider | `AI_BASE_URL` | example `AI_MODEL` |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Qwen (DashScope) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| OpenRouter | `https://openrouter.ai/api/v1` | `<vendor>/<model>` |
| Ollama (local) | `http://localhost:11434/v1` | `qwen2.5` (any key value) |

Leave `AI_API_KEY` empty and the backend still starts — it just falls back to the
offline keyword parser, which is enough to click through the UI.

Providers vary in how well they honour JSON Schema. `llm_client.py` asks for
`response_format=json_schema` first and retries with `json_object` if the provider
rejects it, so both kinds work; the schema is repeated in the system prompt either way.

Full setup notes, including data resets and troubleshooting: [`HOW_TO_RUN.txt`](HOW_TO_RUN.txt).

---

## Using it — a two-minute walkthrough

1. **Chat** tab. Pick a caregiver in the top bar — say Amy.
2. Send `Dad ate half a bowl of porridge at 8:30.`
   → an "AI understood" card appears. Press **Confirm** (or **Edit** to correct it first).
3. Send `Dad has physiotherapy tomorrow at 3 PM.`
   → **Confirm**. It clashes with the physio already on the schedule, so the conflict card appears with Keep both / Replace existing / Discard new.
4. **Care Board** tab.
   → your events are on the daily timeline, the appointment is under Upcoming tasks.
5. Press **Generate handoff to Ben**.
6. In the summary, click a small **source** chip.
   → it jumps to the original entry and highlights it. Hover it to see Amy's exact sentence.

Try Chinese too: `爸爸中午喝了一杯水，看起来比平常累。` — the assistant replies in Chinese and, because tiredness reads as a symptom, walks through a short intake before recording.

Switch the caregiver in the top bar to see the separate-threads model: Ben's chat is his own, but the board is shared.

Live AI takes roughly 2-5 seconds per message. That is normal.

The **Plant demo conflict** button on the Care Board (demo mode only) recreates step 3's clash without typing.

### Resetting the demo data

Two independent stores — clear both for a clean run.

**In the browser** (F12 → Console):

```js
localStorage.removeItem('careRelay.threads');
localStorage.removeItem('careRelay.caregiverId');
location.reload();
```

**In the backend** — stop uvicorn first, then delete `backend/care_relay.db` and the files in `backend/uploads/` (keep `.gitkeep`). It re-creates and re-seeds on the next start. Both are gitignored, so a fresh clone starts clean anyway.

---

## Project layout

```text
CareRelay/
├── frontend/          React 18 + Vite 5, plain CSS
│   └── src/
│       ├── pages/         LandingPage · ChatPage · CareBoardPage
│       ├── components/    Timeline, ScheduleList, ConflictAlert, HandoffCard, AddTaskForm, …
│       ├── services/      api.js (live) · mockBackend.js (offline demo)
│       └── lib/care.js    date and formatting helpers
├── backend/
│   └── app/
│       ├── main.py        app setup, CORS, /uploads, /health
│       ├── models.py      CareEvent · ScheduleItem · Caregiver · Attachment
│       ├── schemas.py     Pydantic contracts incl. ConversationOutput
│       ├── routes/        bootstrap · chat · conflicts · events · schedules ·
│       │                  handoffs · attachments · care_board
│       ├── services/      llm_client (provider-agnostic) · conversation_agent ·
│       │                  handoff_agent · conflict_engine · approval_service ·
│       │                  conflict_store · handoff_service
│       └── tools/         create_care_event · create_schedule_item ·
│                          check_schedule_conflict · get_handoff_context
└── demo/              seed data and demo script
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/bootstrap` | Caregivers, care recipient, current shift |
| POST | `/api/chat` | Send a caregiver message → structured result |
| POST | `/api/chat/confirm` | Approve or reject a proposed write |
| POST | `/api/events` | Create an event manually |
| PATCH | `/api/events/{event_id}` | Edit an event |
| POST | `/api/schedules` | Create a schedule item (returns conflicts) |
| PATCH | `/api/schedules/{schedule_id}` | Edit / mark completed |
| POST | `/api/conflicts/resolve` | `keep_both` · `replace_existing` · `discard_new` |
| GET | `/api/care-board` | Timeline, schedule, conflicts, shift |
| POST | `/api/handoffs/generate` | Handoff summary for a time range |
| POST | `/api/attachments` | Image / voice upload |
| GET | `/health` | Liveness plus `ai_configured` / `ai_model` |

Interactive docs while the backend is running: <http://localhost:8000/docs>

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `'npm' is not recognized` | Install Node from nodejs.org, then open a **new** terminal |
| Port 5173 in use | `npm run dev -- --port 5174` |
| Port 8000 in use | An old backend is still running — close it, or find the PID with `netstat -ano \| findstr :8000` |
| Badge stuck on "Demo data" | Backend not answering. Check <http://localhost:8000/health> |
| `ai_configured: false` | `.env` is missing, or `AI_API_KEY` / `AI_MODEL` is blank. Restart uvicorn after editing |
| `401` / `invalid api key` in the backend log | Wrong key for that `AI_BASE_URL` — key and base URL must be from the same provider |
| `404 model not found` | `AI_MODEL` is not a model that provider serves |
| Mic button greyed out | Browser dictation is Chrome / Edge only — type instead |
| Photo does not appear | Uploading needs the backend. In demo mode the image lives only in the browser and is lost on refresh |
| Page is blank | F12 → Console → read the first red error |
| Changes not showing | Hard reload with Ctrl+Shift+R |

---

## Safety boundary

CareRelay records and summarises information that caregivers provide. It does **not** diagnose conditions, recommend medication, or assert that an unrecorded task was missed. Database writes and conflict resolutions always require human confirmation.
