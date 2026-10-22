from datetime import date, timedelta

from .calculations import calculate_snapshot
from .repository import FinancialRepository
from .schemas import Period, TrendPoint


class FinancialService:
    def __init__(self, repository: FinancialRepository):
        self.repository = repository

    def records(self, business_id: str, through: date):
        records = self.repository.load_records(business_id, through)
        if records.business_id != business_id:
            raise PermissionError("Repository returned another business's records")
        return records

    def financial_snapshot(self, business_id: str, period: Period):
        return calculate_snapshot(self.records(business_id, period.end), period)

    def obligations(self, business_id: str, as_at: date, before: date):
        if before < as_at:
            raise ValueError("Obligation cutoff must be on or after as_at")
        return calculate_snapshot(self.records(business_id, as_at), Period(start=as_at, end=as_at), before)

    def trends(self, business_id: str, end: date, months: int):
        if not 1 <= months <= 24:
            raise ValueError("months must be between 1 and 24")
        records = self.records(business_id, end)
        points = []
        for offset in reversed(range(months)):
            index = end.year * 12 + end.month - 1 - offset
            year, month = divmod(index, 12)
            start = date(year, month + 1, 1)
            next_year, next_month = divmod(index + 1, 12)
            stop = min(end, date(next_year, next_month + 1, 1) - timedelta(days=1))
            snapshot = calculate_snapshot(records, Period(start=start, end=stop))
            in_period = lambda row: start <= row.date <= stop
            revenue_count = sum(1 for row in records.sales if in_period(row)) if "Sales" in records.available_sheets else None
            expense_count = sum(1 for row in records.expenses if in_period(row)) if "Expenses" in records.available_sheets else None
            points.append(TrendPoint(
                period=snapshot.period,
                revenue_mmk=snapshot.actual.revenue_mmk,
                operating_expenses_mmk=snapshot.actual.operating_expenses_mmk,
                revenue_record_count=revenue_count,
                operating_expense_record_count=expense_count,
            ))
        return {"business_id": business_id, "points": points, "as_of": records.as_of, "import_batch_id": records.import_batch_id}
