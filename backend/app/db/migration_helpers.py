"""Local bootstrap only; production applies database/migrations in order."""
from .models import Base


def initialize_local_database(engine):
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)
