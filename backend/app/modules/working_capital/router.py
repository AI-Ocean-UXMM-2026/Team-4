"""Working-capital API. All POST endpoints only calculate projections."""
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Request

from .cash_conversion import cash_conversion_cycle, ccc_scenario
from .repository import WorkingCapitalRepository
from .reserve import reserve_plan
from .schemas import ReservePlanRequest, ScenarioRequest, WorkingCapitalSnapshot, decimal_assumption, optional_decimal
from .simulations import expense_pause_projection, receivable_collection_projection, slow_stock_projection

router = APIRouter(prefix="/api/v1/working-capital", tags=["working-capital"])


def repository(request: Request) -> WorkingCapitalRepository:
    return WorkingCapitalRepository(request.app.state.sessions())


@router.get("/summary", response_model=WorkingCapitalSnapshot)
def summary(request: Request, business_id: str, safety_buffer_days: int = Query(3, ge=0, le=90)):
    with request.app.state.sessions() as session:
        return WorkingCapitalRepository(session).summary(business_id, safety_buffer_days)


@router.get("/inventory-risks")
def inventory_risks(request: Request, business_id: str, safety_buffer_days: int = Query(3, ge=0, le=90)):
    with request.app.state.sessions() as session:
        inventory, as_of = WorkingCapitalRepository(session).inventory_snapshot(business_id, safety_buffer_days)
    return {"business_id": business_id, "as_of": as_of, "items": inventory, "read_only": True}


@router.post("/simulate")
def simulate(payload: ScenarioRequest):
    """Calculate a scenario without persisting it or changing workbook facts."""
    data = payload.assumptions
    try:
        if payload.scenario_type == "slow_stock":
            result = slow_stock_projection(decimal_assumption(data, "quantity"), decimal_assumption(data, "selling_price_mmk"), decimal_assumption(data, "unit_cost_mmk"), decimal_assumption(data, "discount_pct"), decimal_assumption(data, "sell_through_pct"), data.get("expected_date"))
        elif payload.scenario_type == "receivable_collection":
            result = receivable_collection_projection(decimal_assumption(data, "outstanding_mmk"), decimal_assumption(data, "collection_pct"), data.get("expected_date"))
        elif payload.scenario_type == "expense_pause":
            result = expense_pause_projection(decimal_assumption(data, "amount_mmk"), bool(data.get("is_paid")), bool(data.get("is_immutable")), data.get("expected_date"), data.get("business_impact"))
        else:
            current = cash_conversion_cycle(optional_decimal(data, "dio_days"), optional_decimal(data, "dso_days"), optional_decimal(data, "dpo_days"), demo_estimate=bool(data.get("demo_estimate")))
            current = {**current, "dio_days": optional_decimal(data, "dio_days"), "dso_days": optional_decimal(data, "dso_days"), "dpo_days": optional_decimal(data, "dpo_days")}
            result = ccc_scenario(current, stock_turnover_days=optional_decimal(data, "proposed_dio_days"), collection_days=optional_decimal(data, "proposed_dso_days"), supplier_extension_days=optional_decimal(data, "supplier_extension_days"))
    except (ValueError, ArithmeticError) as error:
        raise HTTPException(status_code=400, detail={"code": "INVALID_SCENARIO", "message": str(error)}) from error
    return {"scenario_type": payload.scenario_type, "result": result, "read_only": True, "records_changed": False}


@router.post("/reserve-plan")
def create_reserve_plan(payload: ReservePlanRequest):
    return {"result": reserve_plan(payload.monthly_essential_costs_mmk, payload.dedicated_reserve_mmk,
                                    payload.target_months, payload.monthly_contribution_mmk,
                                    payload.protected_reserve_target_mmk),
            "read_only": True, "records_changed": False}
