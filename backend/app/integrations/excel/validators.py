from collections import defaultdict
from decimal import Decimal

from .schemas import SCHEMA, ParsedWorkbook, issue

D = Decimal


def validate_workbook(parsed: ParsedWorkbook, business_id: str) -> list[dict]:
    errors = list(parsed.errors)
    index = {}
    for name, rows in parsed.sheets.items():
        index[name] = {}
        for row in rows:
            values = row.values
            row_id = values.get(SCHEMA[name]["id"])
            if values.get("business_id") != business_id:
                errors.append(issue(name, row.excel_row, "business_id", "Row belongs to another business"))
            if row_id in index[name]:
                errors.append(issue(name, row.excel_row, SCHEMA[name]["id"], "Duplicate stable row ID"))
            index[name][row_id] = row
    if len(parsed.sheets.get("Settings", [])) != 1:
        errors.append(issue("Settings", 2, "business_id", "Exactly one Settings row is required"))
    if errors:
        return errors
    opening = parsed.sheets["Settings"][0].values["opening_date"]
    references = {"Sales": ("Products", "product_id"), "Purchases": ("Products", "product_id"),
                  "CustomerReceipts": ("Sales", "sale_id"), "SupplierPayments": ("Purchases", "purchase_id"),
                  "LoanPayments": ("Loans", "loan_id")}
    for name, rows in parsed.sheets.items():
        for row in rows:
            value = row.values
            def err(key, message):
                errors.append(issue(name, row.excel_row, key, message))
            if "date" in value and value["date"] < opening:
                err("date", "Transaction predates the opening date")
            if name in references:
                target, key = references[name]
                other = index.get(target, {}).get(value[key])
                if other is None:
                    err(key, "Referenced ID does not exist in this business/source")
                elif "date" in other.values and value["date"] < other.values["date"]:
                    err("date", "Payment predates its associated transaction")
            if name in ("Sales", "Purchases"):
                total = D(value["quantity"]) * D(value["unit_price_mmk" if name == "Sales" else "unit_cost_mmk"])
                key = "cash_received_mmk" if name == "Sales" else "cash_paid_mmk"
                paid = D(value[key])
                if total != total.quantize(D(".01")):
                    err("quantity", "Quantity times unit price must produce whole hundredths of MMK")
                if paid > total or (value["payment_type"] == "cash" and paid != total):
                    err(key, "Cash transactions must be fully paid; credit payments cannot exceed the total")
            if name == "LoanPayments" and D(value["principal_mmk"]) + D(value["interest_mmk"]) == 0:
                err("principal_mmk", "Loan payment must contain principal or interest")
    if errors:
        return errors
    for child, parent, fk, base, initial in [
        ("CustomerReceipts", "Sales", "sale_id", "unit_price_mmk", "cash_received_mmk"),
        ("SupplierPayments", "Purchases", "purchase_id", "unit_cost_mmk", "cash_paid_mmk"),
        ("LoanPayments", "Loans", "loan_id", "principal_mmk", None),
    ]:
        running = defaultdict(lambda: D(0))
        for row in sorted(parsed.sheets.get(child, []), key=lambda r: (r.values["date"], r.values[SCHEMA[child]["id"]])):
            value = row.values
            original = index[parent][value[fk]].values
            running[value[fk]] += D(value["principal_mmk" if child == "LoanPayments" else "amount_mmk"])
            limit = D(original[base]) if initial is None else D(original["quantity"]) * D(original[base]) - D(original[initial])
            if running[value[fk]] > limit:
                errors.append(issue(child, row.excel_row, "principal_mmk" if initial is None else "amount_mmk", "Cumulative payments exceed the outstanding amount"))
    stock = {key: D(row.values["opening_stock"]) for key, row in index.get("Products", {}).items()}
    events = [(row.values["date"], 0, "Purchases", row) for row in parsed.sheets.get("Purchases", [])]
    events += [(row.values["date"], 1, "Sales", row) for row in parsed.sheets.get("Sales", [])]
    for _, priority, name, row in sorted(events, key=lambda e: (e[0], e[1], e[3].values[SCHEMA[e[2]]["id"]])):
        key = row.values["product_id"]
        stock[key] += D(row.values["quantity"]) * (1 if priority == 0 else -1)
        if stock[key] < 0:
            errors.append(issue(name, row.excel_row, "quantity", "Inventory would become negative on this date"))
    return errors
