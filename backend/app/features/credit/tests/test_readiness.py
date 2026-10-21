from datetime import date

from app.features.credit.readiness import preparation_progress, readiness_categories


def test_zero_debt_business_can_prepare_and_debt_is_not_applicable():
    categories = readiness_categories({"business": {"name": "Tea Shop", "industry": "Retail", "city": "Yangon"}, "tables": {}})
    assert len(categories) >= 6
    debt = next(item for item in categories if item["category"] == "existing_debt")
    assert debt["status"] == "not_applicable"
    profile = next(item for item in categories if item["category"] == "business_profile")
    assert profile["status"] == "missing"
    assert "no registration document metadata" in profile["note"]
    assert preparation_progress(categories)["prepared_categories"] == 0
    assert preparation_progress(categories)["total_categories"] == len(categories) - 1


def test_excel_rows_are_unverified_and_period_gaps_remain_visible():
    categories = readiness_categories({"business": {}, "tables": {"Sales": [
        {"date": date(2025, 1, 1)}, {"date": date(2025, 3, 1)}
    ]}})
    sales = next(item for item in categories if item["category"] == "sales_history")
    assert sales["status"] == "uploaded_unverified"
    assert sales["source"] == "excel_imported"
    assert sales["record_count"] == 2
    assert sales["period_start"] == date(2025, 1, 1)
    assert sales["period_end"] == date(2025, 3, 1)
