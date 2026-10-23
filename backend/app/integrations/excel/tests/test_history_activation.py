from conftest import upload, edit_workbook


def test_history_activation_and_download(client, unscoped_workbook_bytes):
    workbook_bytes = unscoped_workbook_bytes
    # 1. Upload initial workbook (October)
    res1 = client.post("/api/v1/data/upload?business_id=tea-shop", files={"file": ("october-records.xlsx", workbook_bytes)})
    assert res1.status_code == 200
    batch1_id = res1.json()["import_batch_id"]
    assert res1.json()["filename"] == "october-records.xlsx"

    # 2. Upload a modified workbook (November with different expense)
    modified = edit_workbook(workbook_bytes, lambda w: setattr(w["Expenses"]["D2"], "value", 95000))
    res2 = client.post("/api/v1/data/upload?business_id=tea-shop", files={"file": ("november-records.xlsx", modified)})
    assert res2.status_code == 200
    batch2_id = res2.json()["import_batch_id"]

    # Verify current snapshot has the November 95000 expense
    snap_nov = client.get("/api/v1/data/snapshot?business_id=tea-shop").json()
    assert snap_nov["tables"]["Expenses"][0]["amount_mmk"] == "95000.00"

    # 3. Check sync-status history includes both files
    status = client.get("/api/v1/data/sync-status?business_id=tea-shop").json()
    batches = status["imports"]
    assert len(batches) >= 2
    assert batches[0]["filename"] == "november-records.xlsx"
    assert batches[1]["filename"] == "october-records.xlsx"

    # 4. Activate the earlier October snapshot
    activate_res = client.post(f"/api/v1/data/activate-history?business_id=tea-shop&batch_id={batch1_id}")
    assert activate_res.status_code == 200
    assert activate_res.json()["status"] == "activated"

    # Verify current snapshot has now reverted to October's original 50000 expense
    snap_oct = client.get("/api/v1/data/snapshot?business_id=tea-shop").json()
    assert snap_oct["tables"]["Expenses"][0]["amount_mmk"] == "50000.00"
    assert snap_oct["tables"]["Settings"][0]["business_id"] == "tea-shop"

    # 5. Download historical workbook
    download_res = client.get(f"/api/v1/data/history/{batch1_id}/download?business_id=tea-shop")
    assert download_res.status_code == 200
    assert download_res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert download_res.content == workbook_bytes


def test_missing_historical_file_does_not_replace_current_records(client, unscoped_workbook_bytes, monkeypatch):
    initial = upload(client, unscoped_workbook_bytes)
    assert initial.status_code == 200
    historical_batch_id = initial.json()["import_batch_id"]
    changed = edit_workbook(unscoped_workbook_bytes, lambda workbook: setattr(workbook["Expenses"]["D2"], "value", 95000))
    assert upload(client, changed).status_code == 200
    snapshot_url = "/api/v1/data/snapshot?business_id=tea-shop"
    before = client.get(snapshot_url).json()
    history_before = client.get("/api/v1/data/sync-status?business_id=tea-shop").json()["imports"]

    monkeypatch.setattr("app.integrations.excel.router.get_batch_workbook", lambda *_args: None)
    activation = client.post(f"/api/v1/data/activate-history?business_id=tea-shop&batch_id={historical_batch_id}")
    assert activation.status_code == 404, activation.text
    assert activation.json()["error"]["code"] == "WORKBOOK_FILE_NOT_FOUND"
    assert client.get(snapshot_url).json() == before
    assert client.get("/api/v1/data/sync-status?business_id=tea-shop").json()["imports"] == history_before

    download = client.get(f"/api/v1/data/history/{historical_batch_id}/download?business_id=tea-shop")
    assert download.status_code == 404, download.text
    assert download.json()["error"]["code"] == "WORKBOOK_FILE_NOT_FOUND"
