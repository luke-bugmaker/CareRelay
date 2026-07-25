"""Provider-agnostic LLM client.

CareRelay talks to any OpenAI-compatible ``/chat/completions`` endpoint, so the
provider is a config change rather than a code change: set ``AI_BASE_URL``,
``AI_API_KEY`` and ``AI_MODEL`` in ``.env``. Known-good targets include OpenAI,
DeepSeek, Qwen/DashScope, Moonshot, OpenRouter and a local vLLM/Ollama server.

With no key set, ``configured`` is False and callers fall back to their offline
paths, so the app still boots and demos without any AI account.

Structured output: providers disagree on how strictly they support JSON Schema,
so :func:`structured_completion` asks for ``json_schema`` first and transparently
retries with plain ``json_object`` if the provider rejects it. The schema is also
written into the system prompt, which is what actually keeps weaker models in
line. The winning mode is remembered for the process lifetime.
"""

import json
import logging
from typing import Any, TypeVar

from openai import AsyncOpenAI, BadRequestError
from pydantic import BaseModel, ValidationError

from ..config import settings


logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Building the client is cheap, but reusing one keeps the HTTP connection pool
# warm — the TLS handshake was a measurable slice of per-request latency.
_client: AsyncOpenAI | None = None

# None = untested, True = provider accepted response_format=json_schema.
_supports_json_schema: bool | None = None


def configured() -> bool:
    return settings.ai_configured


def get_client() -> AsyncOpenAI:
    """Return the process-wide OpenAI-compatible client, creating it on first use."""
    global _client
    if _client is None:
        if not settings.ai_api_key:
            raise RuntimeError("AI_API_KEY is not set; check .env")
        _client = AsyncOpenAI(
            api_key=settings.ai_api_key,
            base_url=settings.ai_base_url,
            timeout=settings.ai_timeout_seconds,
        )
    return _client


def _schema_prompt(schema_model: type[BaseModel]) -> str:
    schema = json.dumps(schema_model.model_json_schema(), ensure_ascii=False)
    return (
        "Reply with a single JSON object and nothing else — no prose, no markdown "
        f"fence. It must validate against this JSON Schema:\n{schema}"
    )


def _response_format(schema_model: type[BaseModel]) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": schema_model.__name__,
            "schema": schema_model.model_json_schema(),
            # Strict mode demands every property be listed in `required`, which
            # these models deliberately do not do. Non-strict still steers the
            # provider without rejecting valid partial output.
            "strict": False,
        },
    }


def _extract_json(text: str) -> str:
    """Salvage the JSON object from a reply that arrived wrapped in a code fence."""
    body = text.strip()
    if body.startswith("```"):
        body = body.split("```")[1] if "```" in body[3:] else body[3:]
        if body.lstrip().startswith("json"):
            body = body.lstrip()[4:]
    start, end = body.find("{"), body.rfind("}")
    if start != -1 and end > start:
        return body[start:end + 1]
    return body


async def structured_completion(
    *,
    instructions: str,
    messages: list[dict[str, str]],
    schema_model: type[T],
    temperature: float | None = None,
) -> T:
    """Run one chat completion and parse the reply into ``schema_model``.

    ``messages`` is the user/assistant history *without* the system turn; the
    system turn is built from ``instructions`` plus the schema.
    """
    global _supports_json_schema

    client = get_client()
    payload: dict[str, Any] = {
        "model": settings.ai_model,
        "messages": [
            {"role": "system", "content": f"{instructions}\n\n{_schema_prompt(schema_model)}"},
            *messages,
        ],
    }
    if temperature is not None:
        payload["temperature"] = temperature

    if _supports_json_schema is not False:
        try:
            response = await client.chat.completions.create(
                **payload, response_format=_response_format(schema_model)
            )
            _supports_json_schema = True
        except BadRequestError:
            logger.info(
                "%s rejected response_format=json_schema; using json_object",
                settings.ai_base_url,
            )
            _supports_json_schema = False
            response = await client.chat.completions.create(
                **payload, response_format={"type": "json_object"}
            )
    else:
        response = await client.chat.completions.create(
            **payload, response_format={"type": "json_object"}
        )

    content = response.choices[0].message.content or ""
    try:
        return schema_model.model_validate_json(_extract_json(content))
    except ValidationError:
        logger.warning("Model returned output that failed validation: %s", content[:500])
        raise


async def warmup() -> None:
    """Pay TLS/connection setup at boot instead of on the first caregiver message.

    Runs from the app lifespan in the background, so a provider outage degrades to
    the normal per-request error path rather than blocking startup.
    """
    if not configured():
        return
    try:
        client = get_client()
        await client.chat.completions.create(
            model=settings.ai_model,
            messages=[{"role": "user", "content": "ok"}],
            max_tokens=1,
        )
        logger.info("AI client warmed up (model=%s)", settings.ai_model)
    except Exception:  # noqa: BLE001 - warmup must never break startup
        logger.warning("AI warmup failed; first request will be slow", exc_info=True)
