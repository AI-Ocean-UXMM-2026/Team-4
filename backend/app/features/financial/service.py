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

    def trends(self, business_id: str, end: date, months: int = 3, *, start: date | None = None, granularity: str | None = None):
        if start is not None:
            if start > end or granularity not in ("weekly", "monthly"):
                raise ValueError("Invalid trend period")
            records = self.records(business_id, end)
            points = []
            cursor = start
            while cursor <= end:
                if granularity == "weekly":
                    stop = min(end, cursor + timedelta(days=6))
                    partial = (stop - cursor).days < 6
                else:
                    next_month = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
                    stop = min(end, next_month - timedelta(days=1))
                    partial = cursor.day != 1 or stop.day != (next_month - timedelta(days=1)).day
                period = Period(start=cursor, end=stop)
                snapshot = calculate_snapshot(records, period)
                in_period = lambda row: cursor <= row.date <= stop
                revenue_count = sum(1 for row in records.sales if in_period(row)) if "Sales" in records.available_sheets else None
                expense_count = sum(1 for row in records.expenses if in_period(row)) if "Expenses" in records.available_sheets else None
                points.append(TrendPoint(period=period, revenue_mmk=snapshot.actual.revenue_mmk,
                    cogs_mmk=snapshot.actual.cogs_mmk,
                    operating_expenses_mmk=snapshot.actual.operating_expenses_mmk,
                    total_costs_mmk=(snapshot.actual.cogs_mmk + snapshot.actual.operating_expenses_mmk
                        if snapshot.actual.cogs_mmk is not None and snapshot.actual.operating_expenses_mmk is not None else None),
                    revenue_record_count=revenue_count, operating_expense_record_count=expense_count,
                    is_partial=partial))
                cursor = stop + timedelta(days=1)
            return {"business_id": business_id, "points": points, "granularity": granularity,
                    "as_of": records.as_of, "import_batch_id": records.import_batch_id}
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
                cogs_mmk=snapshot.actual.cogs_mmk,
                operating_expenses_mmk=snapshot.actual.operating_expenses_mmk,
                total_costs_mmk=(snapshot.actual.cogs_mmk + snapshot.actual.operating_expenses_mmk
                    if snapshot.actual.cogs_mmk is not None and snapshot.actual.operating_expenses_mmk is not None else None),
                revenue_record_count=revenue_count,
                operating_expense_record_count=expense_count,
                is_partial=start.day != 1 or stop.day != (date(stop.year + (stop.month == 12), stop.month % 12 + 1, 1) - timedelta(days=1)).day,
            ))
        return {"business_id": business_id, "points": points, "as_of": records.as_of, "import_batch_id": records.import_batch_id}
