"""P5 main.py discovers this authenticated router automatically."""
from fastapi import APIRouter, Body, Depends, Query, Request

from ...core.dependencies import authorize_business
from ...core.errors import APIError
from .schemas import AIAnalysis, AnalyzeRequest
from .service import AnalysisService, SourceVersionChanged
from .snapshot_provider import SnapshotProvider

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


def authorized_business(business_id: str = Query(min_length=1),
                        _user_id: str = Depends(authorize_business)) -> str:
    return business_id


def analysis_service(request: Request):
    return AnalysisService(SnapshotProvider(request.app.state.sessions))


@router.post("/analyze", response_model=AIAnalysis)
async def analyze(business_id: str = Depends(authorized_business),
                  body: AnalyzeRequest | None = Body(default=None),
                  service: AnalysisService = Depends(analysis_service)):
    try:
        request_data = body or AnalyzeRequest()
        return await service.analyze(
            business_id,
            expected_source_version=request_data.source_version,
            provider_consent=request_data.provider_consent,
        )
    except SourceVersionChanged:
        raise APIError(409, "SOURCE_CHANGED", "Business data changed. Reload and analyze the current import.") from None
    except PermissionError:
        raise APIError(403, "BUSINESS_FORBIDDEN", "Snapshot is outside this business.") from None
    except LookupError:
        raise APIError(404, "BUSINESS_NOT_FOUND", "Business not found.") from None
    except ValueError:
        raise APIError(422, "SOURCE_INVALID", "The source snapshot needs review.") from None


@router.get("/insights/latest", response_model=AIAnalysis | None)
def latest(business_id: str = Depends(authorized_business),
           service: AnalysisService = Depends(analysis_service)):
    try:
        return service.latest(business_id)
    except LookupError:
        raise APIError(404, "BUSINESS_NOT_FOUND", "Business not found.") from None
