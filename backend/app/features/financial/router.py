"""Authenticated financial endpoints using P5's typed projections."""
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from ...core.dependencies import authorize_business
from ...core.errors import APIError
from .platform import PlatformFinancialService
from .platform_repository import SqlFinancialRepository

from .schemas import FinancialSnapshot, Period
from .service import FinancialService

router = APIRouter(prefix="/api/v1/financial", tags=["financial"])


def authorized_business(business_id: str = Query(min_length=1), _user_id: str = Depends(authorize_business)) -> str:
    return business_id


def financial_service(request: Request):
    return PlatformFinancialService(SqlFinancialRepository(request.app.state.sessions))


def run(operation):
    try:
        return operation()
    except PermissionError:
        raise APIError(403, "BUSINESS_FORBIDDEN", "Financial records are not accessible for this business.") from None
    except ValueError:
        raise APIError(400, "FINANCIAL_INVALID", "Financial records or reporting dates are invalid.") from None


@router.get("/summary", response_model=FinancialSnapshot)
def summary(start: date, end: date, business_id: str = Depends(authorized_business), service: FinancialService = Depends(financial_service)):
    return run(lambda: service.financial_snapshot(business_id, Period(start=start, end=end)))


@router.get("/trends")
def trends(end: date, months: int = Query(3, ge=1, le=24), business_id: str = Depends(authorized_business), service: FinancialService = Depends(financial_service)):
    return run(lambda: service.trends(business_id, end, months))


@router.get("/obligations", response_model=FinancialSnapshot)
def obligations(as_at: date, before: date, business_id: str = Depends(authorized_business), service: FinancialService = Depends(financial_service)):
    return run(lambda: service.obligations(business_id, as_at, before))
