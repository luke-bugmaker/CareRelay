"""Summarises a shift's records into a structured handoff for the next caregiver."""

import json

from ..schemas import HandoffSummaryOutput
from . import llm_client


HANDOFF_INSTRUCTIONS = """
You are the CareRelay handoff summary agent.
Summarize only the structured records supplied by the Python backend.
Separate completed items, needs attention, condition changes, upcoming items,
conflicts, and unconfirmed information.
Every factual statement must include its source event_ids or schedule_ids.
Never diagnose, recommend medication, invent a record, or say that an
unrecorded task was missed. Say that no completion record was submitted.
""".strip()


class HandoffAgent:
    @property
    def configured(self) -> bool:
        return llm_client.configured()

    async def run(self, records: dict) -> HandoffSummaryOutput:
        if not self.configured:
            return HandoffSummaryOutput()

        return await llm_client.structured_completion(
            instructions=HANDOFF_INSTRUCTIONS,
            messages=[{"role": "user", "content": json.dumps(records, ensure_ascii=False)}],
            schema_model=HandoffSummaryOutput,
        )


handoff_agent = HandoffAgent()
