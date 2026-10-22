from sqlalchemy import text
from app.db.connection import make_engine
from app.db.migration_helpers import initialize_local_database


def test_additive_local_upgrade_preserves_legacy_rows(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE users(id VARCHAR(80) PRIMARY KEY)")
        connection.exec_driver_sql("CREATE TABLE businesses(id VARCHAR(80) PRIMARY KEY, name VARCHAR(500) NOT NULL, version INTEGER NOT NULL DEFAULT 0)")
        connection.exec_driver_sql("CREATE TABLE sales(source_id VARCHAR(80), sale_id VARCHAR(80), business_id VARCHAR(80), PRIMARY KEY(source_id, sale_id))")
        connection.exec_driver_sql("CREATE TABLE expenses(source_id VARCHAR(80), expense_id VARCHAR(80), business_id VARCHAR(80), PRIMARY KEY(source_id, expense_id))")
        connection.exec_driver_sql("INSERT INTO users(id) VALUES ('legacy-user')")
        connection.exec_driver_sql("INSERT INTO businesses(id,name,version) VALUES ('legacy-shop','Preserved shop',17)")
    initialize_local_database(engine)
    initialize_local_database(engine)
    with engine.connect() as connection:
        row = connection.execute(text("SELECT name, version, owner_id, currency FROM businesses WHERE id='legacy-shop'")).one()
        assert tuple(row) == ("Preserved shop", 17, None, "MMK")
        assert connection.scalar(text("SELECT count(*) FROM users WHERE id='legacy-user'")) == 1
        assert connection.scalar(text("SELECT avatar_data_url FROM users WHERE id='legacy-user'")) is None
        sales = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(sales)")}
        expenses = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(expenses)")}
        assert {"unit_cost_at_sale_mmk", "cogs_mmk"} <= sales
        assert {"payment_status", "paid_date", "amount_paid_mmk"} <= expenses
    engine.dispose()
