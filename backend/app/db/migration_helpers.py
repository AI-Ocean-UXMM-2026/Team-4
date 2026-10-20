"""Local bootstrap only; production applies database/migrations in order."""
from sqlalchemy import inspect
from .models import Base


def initialize_local_database(engine):
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)
        # Additive upgrade for existing local databases; preserve every legacy row.
        additions = {"users": {"full_name": "VARCHAR(120)", "email": "VARCHAR(254)"},
                     "businesses": {"owner_id": "VARCHAR(80) REFERENCES users(id)", "industry": "VARCHAR(120)",
                                    "city": "VARCHAR(120)", "phone": "VARCHAR(40)", "address": "VARCHAR(500)",
                                    "currency": "VARCHAR(3) NOT NULL DEFAULT 'MMK'"}}
        with engine.begin() as connection:
            for table, columns in additions.items():
                existing = {column["name"] for column in inspect(connection).get_columns(table)}
                for name, sql_type in columns.items():
                    if name not in existing:
                        connection.exec_driver_sql(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {sql_type}')
            connection.exec_driver_sql("CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_owner_id ON businesses(owner_id)")
