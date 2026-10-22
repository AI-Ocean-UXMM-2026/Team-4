"""Accept only model wording that maps exactly to deterministic flags."""
import re

from .schemas import Insight


UNSUPPORTED = re.compile(
    r"\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b|"
    r"guarantee|\bwill\b|approved|approval odds|eligible for a loan|"
    r"overdue|past.due|supplier.+(?:accepted|agreed)|customer.+(?:promised|intends)|"
    r"insolven|bankrupt|sure to|certain to",
    re.IGNORECASE,
)


def grounded_insights(result: dict, flags: list[Insight]) -> list[Insight]:
    if not isinstance(result, dict) or not isinstance(result.get("items"), list):
        raise ValueError("Invalid AI response")
    items = result["items"]
    if len(items) != len(flags):
        raise ValueError("AI response omitted or added flags")
    by_id = {flag.id: flag for flag in flags}
    if len(by_id) != len(flags):
        raise ValueError("Duplicate deterministic flags")
    accepted: list[Insight] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict) or set(item) != {"flag_id", "explanation", "suggested_action"}:
            raise ValueError("Unexpected AI fields")
        identifier = item["flag_id"]
        if not isinstance(identifier, str) or identifier not in by_id or identifier in seen:
            raise ValueError("Unknown or repeated flag")
        seen.add(identifier)
        explanation, action = item["explanation"], item["suggested_action"]
        if not isinstance(explanation, str) or not isinstance(action, str):
            raise ValueError("Invalid AI wording")
        if not (10 <= len(explanation) <= 280 and 10 <= len(action) <= 180):
            raise ValueError("AI wording length invalid")
        if UNSUPPORTED.search(explanation):
            raise ValueError("Unsupported numeric or guaranteed claim")
        accepted.append(by_id[identifier].model_copy(update={
            "explanation": explanation.strip(),
        }))
    return accepted
