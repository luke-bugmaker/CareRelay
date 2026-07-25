"""Turns a caregiver's free-text message into structured CareRelay output.

The agent never writes to the database. It returns a :class:`ConversationOutput`
that ``routes/chat.py`` shows the caregiver for approval first.
"""

from ..schemas import ChatRequest, ConversationOutput
from . import llm_client


AGENT_INSTRUCTIONS = """
You are the CareRelay conversation agent.
Understand caregiver updates and return only the requested structured output.
Extract care events and schedule requests without performing database writes.
Use the supplied client_time as the reference for relative dates and times.
Never diagnose, recommend medication, or claim an unrecorded task was missed.
Preserve the caregiver's original meaning and reply in the user's language.

For ordinary care updates such as meals, hydration, medication already taken,
activities, and general notes:
- Do not conduct an intake interview.
- Reply briefly and create the appropriate care event when the information is
  sufficient. Ask one short clarification only when the record would otherwise
  be unusable.

Only when the caregiver reports a current symptom, conduct a symptom intake.
Collect these five facts across turns:
1. symptom: what is bothering the care recipient
2. location: the exact body location
3. severity: a self-rated integer from 0 to 10
4. duration: how long it has lasted
5. onset: sudden, gradual, or recurrent

During symptom intake:
- Remember facts already supplied earlier in this conversation.
- Ask only 1 or 2 of the most important missing questions per response.
- Do not repeat a question whose answer is already known.
- Until all five facts are known, set needs_clarification=true,
  requested_action=ask_clarification, list the missing fields, and do not
  populate care_events.
- When all five facts are known, set needs_clarification=false and
  requested_action=create_care_event. Create five separate atomic symptom
  care_events: symptom, location, severity, duration, and onset. Each event
  must use category=symptom and put its single fact in the matching details
  field. Use concise titles such as "Symptom: abdominal pain",
  "Location: right upper abdomen", and "Severity: 7/10".
- If more than one distinct symptom is reported, keep the facts for each
  symptom separate and never merge uncertain details.
- The completion reply should only confirm that the information is ready for
  the caregiver to review; it must not diagnose or recommend treatment.

For a schedule request, set requested_action to create_schedule and populate
schedule_item. For a care update, set requested_action to create_care_event and
populate care_events.
""".strip()

# Symptom intake spans several turns, so history is kept per conversation and
# dropped as soon as a turn completes without asking for clarification.
MAX_HISTORY_MESSAGES = 20


class ConversationAgent:
    def __init__(self) -> None:
        self._history: dict[str, list[dict[str, str]]] = {}

    @property
    def configured(self) -> bool:
        return llm_client.configured()

    async def run(self, request: ChatRequest) -> ConversationOutput:
        if not self.configured:
            return self._local_demo_parse(request)

        prompt = (
            f"care_recipient_id={request.care_recipient_id}\n"
            f"caregiver_id={request.caregiver_id}\n"
            f"client_time={request.client_time.isoformat()}\n"
            f"message={request.message}"
        )
        history = self._history.setdefault(request.conversation_id, [])
        history.append({"role": "user", "content": prompt})

        result = await llm_client.structured_completion(
            instructions=AGENT_INSTRUCTIONS,
            messages=history[-MAX_HISTORY_MESSAGES:],
            schema_model=ConversationOutput,
        )

        if result.needs_clarification:
            history.append({
                "role": "assistant",
                "content": result.clarification_question or result.assistant_reply,
            })
        else:
            self._history.pop(request.conversation_id, None)
        return result

    def _local_demo_parse(self, request: ChatRequest) -> ConversationOutput:
        """Offline keyword fallback so the app is usable with no API key set."""
        text = request.message.strip()
        lowered = text.casefold()
        if any(word in lowered for word in ("medicine", "medication", "药", "藥")) and not any(
            char.isdigit() for char in text
        ):
            return ConversationOutput(
                intent="record_care_event",
                assistant_reply="Which medication did the care recipient take?",
                needs_clarification=True,
                clarification_question="Which medication did the care recipient take?",
                missing_fields=["medication_name"],
                requested_action="ask_clarification",
            )

        category = "hydration" if any(
            word in lowered for word in ("water", "drink", "水")
        ) else "general_note"
        return ConversationOutput(
            intent="record_care_event",
            assistant_reply="I understood this as a care update.",
            needs_clarification=False,
            care_events=[{
                "category": category,
                "event_time": request.client_time,
                "title": "Hydration" if category == "hydration" else "Care update",
                "details": {"note": text},
                "status": "completed",
            }],
            requested_action="create_care_event",
        )


conversation_agent = ConversationAgent()
