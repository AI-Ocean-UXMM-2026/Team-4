"""P5 implements this adapter with authorized, business-scoped database queries."""
from datetime import date
from typing import Protocol

from .schemas import FinancialRecords


class FinancialRepository(Protocol):
    def load_records(self, business_id: str, through: date) -> FinancialRecords:
        """Return a consistent validated import snapshot, including history.

        Include sales/purchases before reporting start for outstanding balances,
        cash movements from opening_cash_date inclusive, and outstanding P3
        schedules. Do not return empty data on database/import failure.
        """
        ...
