"""Local bootstrap only; production applies database/migrations in order."""
from sqlalchemy import Date, inspect
from .models import Base
from ..integrations.excel.schemas import SCHEMA
from .models import PROJECTIONS


def initialize_local_database(engine):
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)
        # Additive upgrade for existing local databases; preserve every legacy row.
        additions = {"recorded_loan_balances": {"bank_id": "VARCHAR(40)", "loan_product_id": "VARCHAR(80)",
                         "next_payment_date": "DATE", "next_payment_mmk": "NUMERIC(18,2)", "payment_frequency": "VARCHAR(20)",
                         "annual_rate_pct": "NUMERIC(7,3)", "remaining_term_months": "INTEGER", "repayment_terms": "JSON",
                         "loan_start_date": "DATE", "loan_end_date": "DATE"},
                     "users": {"full_name": "VARCHAR(120)", "email": "VARCHAR(254)", "avatar_data_url": "TEXT"},
                     "businesses": {"owner_id": "VARCHAR(80) REFERENCES users(id)", "industry": "VARCHAR(120)",
                                    "city": "VARCHAR(120)", "phone": "VARCHAR(40)", "address": "VARCHAR(500)",
                                    "currency": "VARCHAR(3) NOT NULL DEFAULT 'MMK'"}}
        for sheet, spec in SCHEMA.items():
            optional = spec.get("optional_fields", [])
            if optional:
                table = PROJECTIONS[sheet]
                additions[table.name] = {
                    field: "DATE" if isinstance(table.c[field].type, Date) else "NUMERIC(18, 2)" if "money" in spec["fields"][field] else "VARCHAR(500)"
                    for field in optional
                }
        with engine.begin() as connection:
            for table, columns in additions.items():
                existing = {column["name"] for column in inspect(connection).get_columns(table)}
                for name, sql_type in columns.items():
                    if name not in existing:
                        connection.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {sql_type}')
            connection.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_owner_id ON businesses(owner_id)")
