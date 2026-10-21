from fastapi import FastAPI, HTTPException, Query
from fastapi.testclient import TestClient

from backend.app.features.financial.router import authorized_business, financial_service, router
from backend.app.features.financial.service import FinancialService
from backend.app.core.errors import APIError, api_error_handler
from .test_calculations import records


def client(configured=True):
    app = FastAPI()
    app.add_exception_handler(APIError, api_error_handler)
    app.include_router(router)
    if configured:
        class Repository:
            def load_records(self, business_id, through):
                return records(business_id=business_id)
        def auth(business_id: str = Query()):
            if business_id != "A":
                raise HTTPException(403)
            return business_id
        app.dependency_overrides[authorized_business] = auth
        app.dependency_overrides[financial_service] = lambda: FinancialService(Repository())
    return TestClient(app)


def test_summary_contract():
    response = client().get("/api/v1/financial/summary?business_id=A&start=2026-10-01&end=2026-10-20")
    assert response.status_code == 200
    data = response.json()
    assert data["actual"]["cash_balance_mmk"] == "100000"
    assert data["import_batch_id"] == "batch-1"
    assert data["period"] == {"start": "2026-10-01", "end": "2026-10-20"}


def test_unconfigured_auth_fails_closed():
    assert client(False).get("/api/v1/financial/summary?business_id=A&start=2026-10-01&end=2026-10-20").status_code == 401


def test_cross_business_forbidden():
    assert client().get("/api/v1/financial/summary?business_id=B&start=2026-10-01&end=2026-10-20").status_code == 403


def test_reversed_dates_rejected():
    assert client().get("/api/v1/financial/summary?business_id=A&start=2026-10-21&end=2026-10-20").status_code == 400


def test_bad_date_rejected():
    assert client().get("/api/v1/financial/summary?business_id=A&start=oops&end=2026-10-20").status_code == 422


def test_trends_and_obligations():
    c = client()
    assert len(c.get("/api/v1/financial/trends?business_id=A&end=2026-10-20&months=3").json()["points"]) == 3
    assert c.get("/api/v1/financial/trends?business_id=A&end=2026-10-20&months=0").status_code == 422
    assert c.get("/api/v1/financial/obligations?business_id=A&as_at=2026-10-20&before=2026-10-31").status_code == 200
