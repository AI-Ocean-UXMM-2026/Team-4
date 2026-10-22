"""Read-only snapshot adapter. P2/P3 supply optional ai_adapter.get_ai_snapshot."""
import importlib
from datetime import date

from sqlalchemy import select

from ...core.demo_data import is_synthetic_seed_workbook
from ...db.models import AIAnalysisReport, Business, ImportBatch
from .schemas import AIAnalysis, SnapshotBundle


def _optional_snapshot(module_name: str, business_id: str, source_version: int, sessions) -> dict | None:
    try:
        module = importlib.import_module(module_name)
    except ModuleNotFoundError as exc:
        if exc.name == module_name or module_name.startswith(f"{exc.name}."):
            return None
        raise
    result = module.get_ai_snapshot(business_id, sessions)
    data = result.model_dump(mode="json") if hasattr(result, "model_dump") else result
    if data["business_id"] != business_id:
        raise PermissionError("Cross-business module snapshot")
    # P2/P3 must state the import version; otherwise they might be stale.
    if data.get("source_version") != source_version:
        return None
    return data


class SnapshotProvider:
    def __init__(self, sessions):
        self.sessions = sessions

    def version(self, business_id: str) -> int:
        with self.sessions() as session:
            business = session.scalar(select(Business).where(Business.id == business_id))
            if business is None:
                raise LookupError("Business not found")
            return business.version

    def latest_analysis(self, business_id: str) -> AIAnalysis | None:
        with self.sessions() as session:
            report = session.get(AIAnalysisReport, business_id)
            if report is None:
                return None
            if report.report.get("business_id") != business_id:
                raise PermissionError("Cross-business AI report")
            return AIAnalysis.model_validate(report.report)

    def save_analysis(self, analysis: AIAnalysis) -> None:
        report = analysis.model_dump(mode="json")
        with self.sessions.begin() as session:
            row = session.get(AIAnalysisReport, analysis.business_id)
            if row is None:
                row = AIAnalysisReport(business_id=analysis.business_id,
                                       source_version=analysis.source_version,
                                       report=report, generated_at=analysis.generated_at)
                session.add(row)
            else:
                row.source_version = analysis.source_version
                row.report = report
                row.generated_at = analysis.generated_at

    def load(self, business_id: str) -> SnapshotBundle:
        version = self.version(business_id)
        financial = None
        try:
            from ..financial.platform import PlatformFinancialService
            from ..financial.platform_repository import SqlFinancialRepository
            from ..financial.schemas import Period
        except ModuleNotFoundError as exc:
            if exc.name != "app.features.financial" and not str(exc.name).startswith("app.features.financial."):
                raise
        else:
            today = date.today()
            period = Period(start=today.replace(day=1), end=today)
            result = PlatformFinancialService(SqlFinancialRepository(self.sessions)).financial_snapshot(business_id, period)
            if result.business_id != business_id:
                raise PermissionError("Cross-business financial snapshot")
            if result.source_version == version:
                financial = result.model_dump(mode="json")
        working = _optional_snapshot("app.features.working_capital.ai_adapter", business_id, version, self.sessions)
        credit = _optional_snapshot("app.features.credit.ai_adapter", business_id, version, self.sessions)
        batch = financial.get("import_batch_id") if financial else None
        with self.sessions() as session:
            imported = session.scalar(
                select(ImportBatch).where(ImportBatch.business_id == business_id,
                                          ImportBatch.status == "success")
                .order_by(ImportBatch.created_at.desc(), ImportBatch.id.desc()).limit(1)
            )
        if imported and batch and imported.id == batch and is_synthetic_seed_workbook(business_id, imported.content_hash):
            for item in (financial, working, credit):
                if item is not None:
                    item["synthetic"] = True
        return SnapshotBundle(business_id=business_id, source_version=version,
                              import_batch_id=batch, financial=financial,
                              working_capital=working, credit=credit)
