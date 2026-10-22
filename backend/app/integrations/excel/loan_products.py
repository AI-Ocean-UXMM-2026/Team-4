"""Product identity catalog. Published rates never override contract terms."""
import json
from pathlib import Path

CATALOG = json.loads((Path(__file__).resolve().parents[4] / "shared/contracts/loan-products.json").read_text(encoding="utf-8"))["banks"]
BANKS = {bank["id"]: bank for bank in CATALOG}


def normalize(value):
    return " ".join(str(value).casefold().split())


def loan_identity_errors(value):
    bank = BANKS.get(value.get("bank_id"))
    if not bank:
        return [("bank_id", "Select a supported bank ID from the template")]
    errors = []
    if normalize(value.get("lender", "")) not in bank["aliases"]:
        errors.append(("lender", "Lender name does not match bank_id"))
    product = next((product for product in bank["products"] if product["id"] == value.get("loan_product_id")), None)
    if not product:
        errors.append(("loan_product_id", "Loan product does not belong to the selected bank"))
    elif normalize(value.get("loan_product", "")) != normalize(product["name"]):
        errors.append(("loan_product", "Loan product name does not match loan_product_id"))
    return errors
