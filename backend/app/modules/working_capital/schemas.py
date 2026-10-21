"""Wire models for read-only working-capital endpoints."""
from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class WorkingCapitalSnapshot(BaseModel):
    business_id: str
    source_version: int | None = None
    as_of: date | None = None
    status: Literal["observed", "insufficient_data"]
    inventory: list[dict[str, Any]] = Field(default_factory=list)
    purchasing_budget: dict[str, Any]
    warnings: list[str] = Field(default_factory=list)


class ScenarioRequest(BaseModel):
    scenario_type: Literal["slow_stock", "receivable_collection", "expense_pause", "cash_gap"]
    assumptions: dict[str, Any]


class ReservePlanRequest(BaseModel):
    monthly_essential_costs_mmk: Decimal = Field(ge=0)
    dedicated_reserve_mmk: Decimal = Field(ge=0)
    target_months: int = Field(ge=1, le=6)
    monthly_contribution_mmk: Decimal = Field(ge=0)


class InventoryRiskQuery(BaseModel):
    safety_buffer_days: int = Field(default=3, ge=0, le=90)


def decimal_assumption(values: dict[str, Any], key: str) -> Decimal:
    if key not in values or values[key] is None:
        raise ValueError(f"{key} is required")
    return Decimal(str(values[key]))


def optional_decimal(values: dict[str, Any], key: str) -> Decimal | None:
    return None if values.get(key) is None else Decimal(str(values[key]))
