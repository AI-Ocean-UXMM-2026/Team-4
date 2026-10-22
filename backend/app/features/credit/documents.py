"""Private supporting files, scoped to an authorized business and application."""
import re
from pathlib import PurePosixPath

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy import select, func

from ...core.dependencies import authorize_business
from ...db.models import CreditDocument
from ...integrations.excel.loan_products import BANKS
from ...integrations.excel.import_service import lock_business

router = APIRouter()
MAX_BYTES = 4 * 1024 * 1024


def check_scope(bank_id, product_id):
    bank = BANKS.get(bank_id)
    if not bank or product_id not in {p["id"] for p in bank["products"]}:
        raise HTTPException(400, "Unknown bank or loan product.")


def metadata(row):
    return {"id": row.id, "requirement_key": row.requirement_key, "filename": row.filename,
            "size": len(row.content), "created_at": row.created_at.isoformat(), "status": "uploaded_unverified"}


@router.get("/documents")
def list_documents(request: Request, business_id: str, bank_id: str, product_id: str, _user=Depends(authorize_business)):
    check_scope(bank_id, product_id)
    with request.app.state.sessions() as session:
        rows = session.scalars(select(CreditDocument).where(CreditDocument.business_id == business_id,
            CreditDocument.bank_id == bank_id, CreditDocument.product_id == product_id).order_by(CreditDocument.created_at)).all()
        return {"documents": [metadata(row) for row in rows]}


@router.post("/documents")
def upload_document(request: Request, business_id: str, bank_id: str, product_id: str, requirement_key: str,
                    file: UploadFile = File(...), _user=Depends(authorize_business)):
    check_scope(bank_id, product_id)
    if not re.fullmatch(r"doc-[0-9]{1,2}|business_profile|sales_history|expense_history|cashflow_history|receivables_payables|existing_debt|lender_documents", requirement_key):
        raise HTTPException(400, "Unknown document requirement.")
    filename = PurePosixPath((file.filename or "").replace("\\", "/")).name[:200]
    suffix = filename.rsplit(".", 1)[-1].lower()
    content = file.file.read(MAX_BYTES + 1)
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(400, "Choose a non-empty file up to 4 MB.")
    types = {"pdf": ("application/pdf", content.startswith(b"%PDF-")),
             "png": ("image/png", content.startswith(b"\x89PNG\r\n\x1a\n")),
             "jpg": ("image/jpeg", content.startswith(b"\xff\xd8\xff")),
             "jpeg": ("image/jpeg", content.startswith(b"\xff\xd8\xff"))}
    if suffix not in types or not types[suffix][1]:
        raise HTTPException(400, "Choose a PDF, PNG or JPEG file with matching file contents.")
    with request.app.state.sessions.begin() as session:
        lock_business(session, business_id)
        total = session.scalar(select(func.coalesce(func.sum(func.length(CreditDocument.content)), 0)).where(CreditDocument.business_id == business_id))
        if total + len(content) > 50 * 1024 * 1024:
            raise HTTPException(400, "This business has reached its 50 MB document limit.")
        row = CreditDocument(business_id=business_id, bank_id=bank_id, product_id=product_id,
            requirement_key=requirement_key, filename=filename, media_type=types[suffix][0], content=content)
        session.add(row)
        session.flush()
        return metadata(row)


@router.get("/documents/{document_id}/download")
def download_document(document_id: str, request: Request, business_id: str, _user=Depends(authorize_business)):
    from urllib.parse import quote
    with request.app.state.sessions() as session:
        row = session.scalar(select(CreditDocument).where(CreditDocument.id == document_id, CreditDocument.business_id == business_id))
        if row is None:
            raise HTTPException(404, "Document not found.")
        return Response(row.content, media_type="application/octet-stream", headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(row.filename, safe='')}", "X-Content-Type-Options": "nosniff"})


@router.delete("/documents/{document_id}")
def delete_document(document_id: str, request: Request, business_id: str, _user=Depends(authorize_business)):
    with request.app.state.sessions.begin() as session:
        row = session.scalar(select(CreditDocument).where(CreditDocument.id == document_id, CreditDocument.business_id == business_id))
        if row is None:
            raise HTTPException(404, "Document not found.")
        session.delete(row)
    return {"deleted": True}
