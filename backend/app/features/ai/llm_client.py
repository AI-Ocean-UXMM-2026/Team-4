"""Optional provider wording step; all evidence stays under server control."""
import asyncio
import json
import os

import httpx


OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "flag_id": {"type": "string"},
                    "explanation": {"type": "string"},
                    "suggested_action": {"type": "string"},
                },
                "required": ["flag_id", "explanation", "suggested_action"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["items"],
    "additionalProperties": False,
}


class AIWordingClient:
    def __init__(self, api_key: str | None = None, model: str | None = None,
                 allow_real_data: bool | None = None, provider: str | None = None):
        self.provider = (provider or os.getenv("AI_PROVIDER", "openai")).lower()
        if self.provider not in {"openai", "openrouter"}:
            raise ValueError("AI_PROVIDER must be openai or openrouter")
        if self.provider == "openrouter":
            self.api_key = api_key if api_key is not None else os.getenv("OPENROUTER_API_KEY", "")
            self.model = model or os.getenv("OPENROUTER_MODEL", "openai/gpt-5-mini")
            self.endpoint = "https://openrouter.ai/api/v1/responses"
        else:
            self.api_key = api_key if api_key is not None else os.getenv("OPENAI_API_KEY", "")
            self.model = model or os.getenv("OPENAI_MODEL", "gpt-5-mini")
            self.endpoint = "https://api.openai.com/v1/responses"
        self.allow_real_data = (
            allow_real_data if allow_real_data is not None
            else os.getenv("AI_ALLOW_REAL_DATA", "").lower() == "true"
        )

    async def explain(self, flags: list, context: dict) -> dict:
        if not self.api_key:
            raise RuntimeError("AI provider is not configured")
        payload = {
            "model": self.model,
            "store": False,
            "max_output_tokens": 2000,
            "instructions": (
                "You write concise business-analysis wording, not a chatbot. "
                "Use only the supplied flags and metrics. Return one item per flag ID. "
                "Do not include digits, dates, percentages, guarantees, lending approval "
                "claims, customer intentions, or facts not present in the flags. "
                "Explain uncertainty. Do not recommend borrowing as a default fix."
            ),
            "input": json.dumps({
                "metrics": {key: str(value) for key, value in context["metrics"].items()},
                "flags": [
                    {"flag_id": flag.id, "explanation": flag.explanation,
                     "suggested_action": flag.suggested_actions[0]}
                    for flag in flags
                ],
            }),
            "text": {"format": {
                "type": "json_schema", "name": "business_analysis_wording",
                "strict": True, "schema": OUTPUT_SCHEMA,
            }},
        }
        if self.provider == "openrouter":
            payload["provider"] = {"require_parameters": True}
            if self.model == "openai/gpt-5-mini":
                payload["reasoning"] = {"effort": "minimal"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            for attempt in range(2):
                response = await client.post(
                    self.endpoint,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                )
                if response.status_code == 429:
                    try:
                        error_code = (response.json().get("error") or {}).get("code")
                    except (ValueError, AttributeError):
                        error_code = None
                    if error_code in {"credit_balance_exhausted", "organization_spend_limit_exceeded",
                                      "project_spend_limit_exceeded", "organization_usage_limit_exceeded"}:
                        response.raise_for_status()
                if response.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                    await asyncio.sleep(0.4)
                    continue
                response.raise_for_status()
                data = response.json()
                if data.get("status") != "completed":
                    raise ValueError("AI response was not completed")
                texts = [
                    part["text"]
                    for item in data.get("output", [])
                    for part in item.get("content", [])
                    if part.get("type") == "output_text" and isinstance(part.get("text"), str)
                ]
                if len(texts) != 1:
                    raise ValueError("AI response text missing")
                return json.loads(texts[0])
        raise RuntimeError("AI provider failed")
