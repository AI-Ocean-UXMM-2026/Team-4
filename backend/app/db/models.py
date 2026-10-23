"""Audit records plus typed SQL projections for module owners (no Excel JSON parsing)."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (JSON, Column, Date, DateTime, ForeignKey, Integer, MetaData,
                        Numeric, String, Table, Text, UniqueConstraint, LargeBinary)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from ..integrations.excel.schemas import SCHEMA


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={"ix": "ix_%(column_0_label)s", "uq": "uq_%(table_name)s_%(column_0_name)s",
                                          "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
                                          "pk": "pk_%(table_name)s"})


class CreditDocument(Base):
    __tablename__ = "credit_documents"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=uid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), index=True)
    bank_id: Mapped[str] = mapped_column(String(40))
    product_id: Mapped[str] = mapped_column(String(80))
    requirement_key: Mapped[str] = mapped_column(String(80))
    filename: Mapped[str] = mapped_column(String(200))
    media_type: Mapped[str] = mapped_column(String(80))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RecordedLoanBalance(Base):
    __tablename__ = "recorded_loan_balances"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=uid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), index=True)
    lender_kind: Mapped[str] = mapped_column(String(20))
    lender_name: Mapped[str] = mapped_column(String(200))
    bank_id: Mapped[str | None] = mapped_column(String(40))
    loan_product_id: Mapped[str | None] = mapped_column(String(80))
    next_payment_date: Mapped[date | None] = mapped_column(Date)
    next_payment_mmk: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    payment_frequency: Mapped[str | None] = mapped_column(String(20))
    annual_rate_pct: Mapped[Decimal | None] = mapped_column(Numeric(7, 3))
    remaining_term_months: Mapped[int | None] = mapped_column(Integer)
    repayment_terms: Mapped[dict | None] = mapped_column(JSON)
    outstanding_principal_mmk: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    as_of_date: Mapped[date] = mapped_column(Date)
    loan_start_date: Mapped[date | None] = mapped_column(Date)
    loan_end_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    full_name: Mapped[str | None] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(254))
    avatar_data_url: Mapped[str | None] = mapped_column(Text)


class Business(Base):
    __tablename__ = "businesses"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(500))
    version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), unique=True)
    industry: Mapped[str | None] = mapped_column(String(120))
    city: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(String(500))
    currency: Mapped[str] = mapped_column(String(3), default="MMK", server_default="MMK")


class AuthRequestLimit(Base):
    __tablename__ = "auth_request_limits"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    count: Mapped[int] = mapped_column(Integer, default=0)


class Membership(Base):
    __tablename__ = "business_memberships"
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)


class WorkbookSource(Base):
    __tablename__ = "workbook_sources"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=uid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), unique=True)
    kind: Mapped[str] = mapped_column(String(20), default="manual")
    drive_id: Mapped[str | None] = mapped_column(String(250))
    item_id: Mapped[str | None] = mapped_column(String(250))
    linked_user_id: Mapped[str | None] = mapped_column(String(80))
    token_ciphertext: Mapped[str | None] = mapped_column(Text)
    last_etag: Mapped[str | None] = mapped_column(String(500))
    last_hash: Mapped[str | None] = mapped_column(String(64))
    last_import_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=uid)
    source_id: Mapped[str] = mapped_column(ForeignKey("workbook_sources.id"), index=True)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), index=True)
    actor_id: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    row_counts: Mapped[dict] = mapped_column(JSON, default=dict)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ImportedRow(Base):
    __tablename__ = "imported_rows"
    __table_args__ = (UniqueConstraint("business_id", "source_id", "sheet_name", "row_id"),)
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=uid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), index=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("workbook_sources.id"))
    sheet_name: Mapped[str] = mapped_column(String(50))
    row_id: Mapped[str] = mapped_column(String(80))
    payload: Mapped[dict] = mapped_column(JSON)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.id"))
    revision: Mapped[int] = mapped_column(Integer, default=1)
    active_status: Mapped[str] = mapped_column(String(20), default="active")


class RowRevision(Base):
    __tablename__ = "row_revisions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=uid)
    imported_row_id: Mapped[str] = mapped_column(ForeignKey("imported_rows.id"))
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"))
    payload: Mapped[dict] = mapped_column(JSON)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.id"))
    revision: Mapped[int] = mapped_column(Integer)


class AIAnalysisReport(Base):
    """Latest authenticated AI report, scoped to one business and source version."""
    __tablename__ = "ai_analysis_reports"
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), primary_key=True)
    source_version: Mapped[int] = mapped_column(Integer, nullable=False)
    report: Mapped[dict] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class OAuthState(Base):
    __tablename__ = "oauth_states"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"))
    user_id: Mapped[str] = mapped_column(String(80))
    verifier_ciphertext: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


TABLE_NAMES = {"Settings": "business_settings", "Products": "products", "Sales": "sales",
               "CustomerReceipts": "customer_receipts", "Purchases": "purchases",
               "SupplierPayments": "supplier_payments", "Expenses": "expenses", "Loans": "loans",
               "LoanPayments": "loan_payments", "CashAdjustments": "cash_adjustments", "CashBalances": "cash_balances"}
PROJECTIONS = {}
for sheet_name, spec in SCHEMA.items():
    columns = [Column("source_id", String(80), ForeignKey("workbook_sources.id"), primary_key=True)]
    for field, kind in spec["fields"].items():
        column_type = Date if kind == "date" else Numeric(18, 3 if "quantity" in kind else 2) if "money" in kind or "quantity" in kind else String(500)
        args = [ForeignKey("businesses.id")] if field == "business_id" else []
        optional = field in spec.get("optional_fields", [])
        columns.append(Column(field, column_type, *args, primary_key=field == spec["id"], nullable=optional, index=field == "business_id"))
    columns.append(Column("batch_id", String(80), ForeignKey("import_batches.id"), nullable=False))
    PROJECTIONS[sheet_name] = Table(TABLE_NAMES[sheet_name], Base.metadata, *columns)
