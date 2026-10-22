"""The AI boundary accepts snapshots and returns evidence-backed insights only."""
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Evidence(StrictModel):
    metric: str
    value: Decimal


class Insight(StrictModel):
    id: str
    category: Literal["liquidity", "working_capital", "credit", "data_quality"]
    priority: Literal["high", "medium", "low"]
    title: str
    explanation: str
    evidence: list[Evidence] = Field(min_length=1, max_length=5)
    suggested_actions: list[str] = Field(min_length=1, max_length=3)
    assumptions: list[str] = Field(default_factory=list, max_length=3)


class AIAnalysis(StrictModel):
    business_id: str
    status: Literal["completed", "rules_only", "insufficient_data", "unavailable"]
    data_as_of: datetime | None
    source_version: int
    import_batch_id: str | None
    generated_at: datetime
    outdated: bool = False
    insights: list[Insight] = Field(default_factory=list, max_length=5)
    warnings: list[str] = Field(default_factory=list)
    disclaimer: str


class AnalyzeRequest(StrictModel):
    source_version: int | None = Field(default=None, ge=0, strict=True)
    provider_consent: bool = Field(default=False, strict=True)


class SnapshotBundle(StrictModel):
    """P1/P2/P3 service outputs are passed in, never workbook transactions."""
    business_id: str
    source_version: int
    import_batch_id: str | None = None
    financial: dict | None = None
    working_capital: dict | None = None
    credit: dict | None = None
