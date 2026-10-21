"""Cash-conversion-cycle calculations, kept separate from cash forecasts."""
from decimal import Decimal, ROUND_HALF_UP


def cash_conversion_cycle(dio_days: Decimal | None, dso_days: Decimal | None, dpo_days: Decimal | None, *, demo_estimate=False) -> dict:
    if any(value is None for value in (dio_days, dso_days, dpo_days)):
        return {"status": "insufficient_data", "ccc_days": None, "label": "MMK estimate unavailable"}
    values = [Decimal(dio_days), Decimal(dso_days), Decimal(dpo_days)]
    if any(value < 0 for value in values):
        raise ValueError("CCC inputs cannot be negative")
    return {
        "status": "demo_estimate" if demo_estimate else "observed",
        "ccc_days": (values[0] + values[1] - values[2]).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP),
        "label": "CCC is a days measure; MMK estimate unavailable without a dated cash forecast.",
    }


def ccc_scenario(current: dict, *, stock_turnover_days: Decimal | None = None, collection_days: Decimal | None = None, supplier_extension_days: Decimal | None = None) -> dict:
    if current.get("ccc_days") is None:
        return {"status": "insufficient_data", "current": current, "proposed": None}
    dio = Decimal(current["dio_days"] if stock_turnover_days is None else stock_turnover_days)
    dso = Decimal(current["dso_days"] if collection_days is None else collection_days)
    dpo = Decimal(current["dpo_days"]) + Decimal(supplier_extension_days or 0)
    proposed = cash_conversion_cycle(dio, dso, dpo, demo_estimate=current.get("status") == "demo_estimate")
    return {"status": proposed["status"], "current": current, "proposed": {**proposed, "dio_days": dio, "dso_days": dso, "dpo_days": dpo}, "projected_only": True}
