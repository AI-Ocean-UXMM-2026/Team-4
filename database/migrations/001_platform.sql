-- Shay Sett platform v1. Generated from SQLAlchemy metadata; apply once.


CREATE TABLE businesses (
	id VARCHAR(80) NOT NULL,
	name VARCHAR(500) NOT NULL,
	version INTEGER DEFAULT '0' NOT NULL,
	CONSTRAINT pk_businesses PRIMARY KEY (id)
);

CREATE TABLE users (
	id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_users PRIMARY KEY (id)
);

CREATE TABLE business_memberships (
	business_id VARCHAR(80) NOT NULL,
	user_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_business_memberships PRIMARY KEY (business_id, user_id),
	CONSTRAINT fk_business_memberships_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_business_memberships_user_id_users FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE oauth_states (
	id VARCHAR(64) NOT NULL,
	business_id VARCHAR(80) NOT NULL,
	user_id VARCHAR(80) NOT NULL,
	verifier_ciphertext TEXT NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	CONSTRAINT pk_oauth_states PRIMARY KEY (id),
	CONSTRAINT fk_oauth_states_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id)
);

CREATE TABLE workbook_sources (
	id VARCHAR(80) NOT NULL,
	business_id VARCHAR(80) NOT NULL,
	kind VARCHAR(20) NOT NULL,
	drive_id VARCHAR(250),
	item_id VARCHAR(250),
	linked_user_id VARCHAR(80),
	token_ciphertext TEXT,
	last_etag VARCHAR(500),
	last_hash VARCHAR(64),
	last_import_at TIMESTAMP WITH TIME ZONE,
	last_checked_at TIMESTAMP WITH TIME ZONE,
	CONSTRAINT pk_workbook_sources PRIMARY KEY (id),
	CONSTRAINT uq_workbook_sources_business_id UNIQUE (business_id),
	CONSTRAINT fk_workbook_sources_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id)
);

CREATE TABLE import_batches (
	id VARCHAR(80) NOT NULL,
	source_id VARCHAR(80) NOT NULL,
	business_id VARCHAR(80) NOT NULL,
	actor_id VARCHAR(80) NOT NULL,
	status VARCHAR(30) NOT NULL,
	content_hash VARCHAR(64),
	row_counts JSON NOT NULL,
	errors JSON NOT NULL,
	warnings JSON NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	CONSTRAINT pk_import_batches PRIMARY KEY (id),
	CONSTRAINT fk_import_batches_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_import_batches_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id)
);

CREATE INDEX ix_import_batches_business_id ON import_batches (business_id);

CREATE INDEX ix_import_batches_source_id ON import_batches (source_id);

CREATE TABLE business_settings (
	source_id VARCHAR(80) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	business_name VARCHAR(500) NOT NULL,
	currency VARCHAR(500) NOT NULL,
	opening_date DATE NOT NULL,
	opening_cash_mmk NUMERIC(18, 2) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_business_settings PRIMARY KEY (source_id, business_id),
	CONSTRAINT fk_business_settings_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_business_settings_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_business_settings_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_business_settings_business_id ON business_settings (business_id);

CREATE TABLE cash_adjustments (
	source_id VARCHAR(80) NOT NULL,
	adjustment_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	date DATE NOT NULL,
	direction VARCHAR(500) NOT NULL,
	amount_mmk NUMERIC(18, 2) NOT NULL,
	reason VARCHAR(500) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_cash_adjustments PRIMARY KEY (source_id, adjustment_id),
	CONSTRAINT fk_cash_adjustments_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_cash_adjustments_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_cash_adjustments_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_cash_adjustments_business_id ON cash_adjustments (business_id);

CREATE TABLE customer_receipts (
	source_id VARCHAR(80) NOT NULL,
	receipt_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	date DATE NOT NULL,
	sale_id VARCHAR(500) NOT NULL,
	amount_mmk NUMERIC(18, 2) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_customer_receipts PRIMARY KEY (source_id, receipt_id),
	CONSTRAINT fk_customer_receipts_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_customer_receipts_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_customer_receipts_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_customer_receipts_business_id ON customer_receipts (business_id);

CREATE TABLE expenses (
	source_id VARCHAR(80) NOT NULL,
	expense_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	date DATE NOT NULL,
	category VARCHAR(500) NOT NULL,
	amount_mmk NUMERIC(18, 2) NOT NULL,
	description VARCHAR(500) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_expenses PRIMARY KEY (source_id, expense_id),
	CONSTRAINT fk_expenses_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_expenses_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_expenses_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_expenses_business_id ON expenses (business_id);

CREATE TABLE imported_rows (
	id VARCHAR(80) NOT NULL,
	business_id VARCHAR(80) NOT NULL,
	source_id VARCHAR(80) NOT NULL,
	sheet_name VARCHAR(50) NOT NULL,
	row_id VARCHAR(80) NOT NULL,
	payload JSON NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	revision INTEGER NOT NULL,
	active_status VARCHAR(20) NOT NULL,
	CONSTRAINT pk_imported_rows PRIMARY KEY (id),
	CONSTRAINT uq_imported_rows_business_id UNIQUE (business_id, source_id, sheet_name, row_id),
	CONSTRAINT fk_imported_rows_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_imported_rows_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_imported_rows_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_imported_rows_business_id ON imported_rows (business_id);

CREATE TABLE loan_payments (
	source_id VARCHAR(80) NOT NULL,
	payment_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	date DATE NOT NULL,
	loan_id VARCHAR(500) NOT NULL,
	principal_mmk NUMERIC(18, 2) NOT NULL,
	interest_mmk NUMERIC(18, 2) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_loan_payments PRIMARY KEY (source_id, payment_id),
	CONSTRAINT fk_loan_payments_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_loan_payments_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_loan_payments_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_loan_payments_business_id ON loan_payments (business_id);

CREATE TABLE loans (
	source_id VARCHAR(80) NOT NULL,
	loan_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	date DATE NOT NULL,
	lender VARCHAR(500) NOT NULL,
	loan_type VARCHAR(500) NOT NULL,
	principal_mmk NUMERIC(18, 2) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_loans PRIMARY KEY (source_id, loan_id),
	CONSTRAINT fk_loans_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_loans_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_loans_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_loans_business_id ON loans (business_id);

CREATE TABLE products (
	source_id VARCHAR(80) NOT NULL,
	product_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	name VARCHAR(500) NOT NULL,
	opening_stock NUMERIC(18, 3) NOT NULL,
	unit_cost_mmk NUMERIC(18, 2) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_products PRIMARY KEY (source_id, product_id),
	CONSTRAINT fk_products_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_products_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_products_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_products_business_id ON products (business_id);

CREATE TABLE purchases (
	source_id VARCHAR(80) NOT NULL,
	purchase_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	date DATE NOT NULL,
	product_id VARCHAR(500) NOT NULL,
	quantity NUMERIC(18, 3) NOT NULL,
	unit_cost_mmk NUMERIC(18, 2) NOT NULL,
	payment_type VARCHAR(500) NOT NULL,
	cash_paid_mmk NUMERIC(18, 2) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_purchases PRIMARY KEY (source_id, purchase_id),
	CONSTRAINT fk_purchases_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_purchases_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_purchases_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_purchases_business_id ON purchases (business_id);

CREATE TABLE sales (
	source_id VARCHAR(80) NOT NULL,
	sale_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	date DATE NOT NULL,
	product_id VARCHAR(500) NOT NULL,
	quantity NUMERIC(18, 3) NOT NULL,
	unit_price_mmk NUMERIC(18, 2) NOT NULL,
	payment_type VARCHAR(500) NOT NULL,
	cash_received_mmk NUMERIC(18, 2) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_sales PRIMARY KEY (source_id, sale_id),
	CONSTRAINT fk_sales_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_sales_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_sales_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_sales_business_id ON sales (business_id);

CREATE TABLE supplier_payments (
	source_id VARCHAR(80) NOT NULL,
	payment_id VARCHAR(500) NOT NULL,
	business_id VARCHAR(500) NOT NULL,
	date DATE NOT NULL,
	purchase_id VARCHAR(500) NOT NULL,
	amount_mmk NUMERIC(18, 2) NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	CONSTRAINT pk_supplier_payments PRIMARY KEY (source_id, payment_id),
	CONSTRAINT fk_supplier_payments_source_id_workbook_sources FOREIGN KEY(source_id) REFERENCES workbook_sources (id),
	CONSTRAINT fk_supplier_payments_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_supplier_payments_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);

CREATE INDEX ix_supplier_payments_business_id ON supplier_payments (business_id);

CREATE TABLE row_revisions (
	id VARCHAR(80) NOT NULL,
	imported_row_id VARCHAR(80) NOT NULL,
	business_id VARCHAR(80) NOT NULL,
	payload JSON NOT NULL,
	batch_id VARCHAR(80) NOT NULL,
	revision INTEGER NOT NULL,
	CONSTRAINT pk_row_revisions PRIMARY KEY (id),
	CONSTRAINT fk_row_revisions_imported_row_id_imported_rows FOREIGN KEY(imported_row_id) REFERENCES imported_rows (id),
	CONSTRAINT fk_row_revisions_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id),
	CONSTRAINT fk_row_revisions_batch_id_import_batches FOREIGN KEY(batch_id) REFERENCES import_batches (id)
);
