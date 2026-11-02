import io


def get_tokens(client):
    admin_res = client.post("/api/auth/login", json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"})
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    client.post(
        "/api/users",
        json={"username": "user1", "name": "User Satu", "password": "password123", "role": "user"},
        headers=admin_headers,
    )
    client.post(
        "/api/users",
        json={"username": "user2", "name": "User Dua", "password": "password123", "role": "user"},
        headers=admin_headers,
    )

    u1_res = client.post("/api/auth/login", json={"username": "user1", "password": "password123"})
    u2_res = client.post("/api/auth/login", json={"username": "user2", "password": "password123"})
    return u1_res.json()["access_token"], u2_res.json()["access_token"]


def test_income_crud_and_isolation(client):
    u1_token, u2_token = get_tokens(client)
    h1 = {"Authorization": f"Bearer {u1_token}"}
    h2 = {"Authorization": f"Bearer {u2_token}"}

    # User 1 seed kategori default
    client.post("/api/categories/seed-defaults", headers=h1)

    # Ambil category income
    cats = client.get("/api/categories?type=income", headers=h1).json()
    cat_id = cats[0]["id"]

    # 1. User 1 membuat pemasukan
    res = client.post(
        "/api/incomes",
        data={
            "trx_date": "2026-11-01",
            "party": "Klien PT ABC",
            "category_id": cat_id,
            "amount": 5000000,
            "currency_code": "IDR",
            "payment_method": "Transfer BCA",
            "description": "Pembayaran invoice project",
        },
        headers=h1,
    )
    assert res.status_code == 201
    trx1_id = res.json()["id"]

    # 2. User 1 bisa melihat transaksinya
    list1 = client.get("/api/transactions", headers=h1).json()
    assert len(list1) == 1
    assert list1[0]["id"] == trx1_id

    # 3. User 2 TIDAK BISA melihat transaksi User 1 (Data Isolation)
    list2 = client.get("/api/transactions", headers=h2).json()
    assert len(list2) == 0

    # User 2 coba akses langsung lampiran/detail -> 404
    att_fail = client.get(f"/api/transactions/{trx1_id}/attachment", headers=h2)
    assert att_fail.status_code == 404

    # 4. User 1 mengubah Pihak dan Keterangan (inline edit)
    patch_res = client.patch(
        f"/api/transactions/{trx1_id}",
        json={"party": "Klien PT ABC Sejahtera", "description": "Pembayaran termin 1 lunas"},
        headers=h1,
    )
    assert patch_res.status_code == 200
    updated_data = patch_res.json()
    assert updated_data["party"] == "Klien PT ABC Sejahtera"
    assert updated_data["description"] == "Pembayaran termin 1 lunas"

    # User 2 mencoba patch transaksi User 1 -> 404
    patch_fail = client.patch(
        f"/api/transactions/{trx1_id}",
        json={"party": "Hacker"},
        headers=h2,
    )
    assert patch_fail.status_code == 404


def test_expense_upload_and_confirm(client, monkeypatch):
    u1_token, _ = get_tokens(client)
    h1 = {"Authorization": f"Bearer {u1_token}"}

    # Mocking Gemini AI extractor
    def mock_extract(image_bytes, mime_type, available_categories, *args, **kwargs):
        return "success", {
            "date": "2026-11-02",
            "vendor": "Restoran Padang Sederhana",
            "total": 125000,
            "currency": "IDR",
            "category": "makanan",
            "description": "Makan siang meeting tim",
        }, {"mock": True}

    import app.routers.expenses as exp_module
    monkeypatch.setattr(exp_module, "extract_expense_from_receipt", mock_extract)

    # 1. Upload struk
    fake_img = io.BytesIO(b"fake image receipt bytes")
    files = {"file": ("struk.jpg", fake_img, "image/jpeg")}
    upload_res = client.post("/api/expenses/upload", files=files, headers=h1)
    assert upload_res.status_code == 201
    data = upload_res.json()
    assert data["status"] == "draft"
    assert data["party"] == "Restoran Padang Sederhana"
    assert data["amount"] == 125000
    draft_id = data["id"]

    # 2. Konfirmasi pengeluaran (User 1 seed default jika belum)
    client.post("/api/categories/seed-defaults", headers=h1)
    cats = client.get("/api/categories?type=expense", headers=h1).json()
    cat_id = cats[0]["id"]

    confirm_res = client.post(
        f"/api/expenses/{draft_id}/confirm",
        json={
            "trx_date": "2026-11-02",
            "party": "Restoran Padang Sederhana",
            "category_id": cat_id,
            "amount": 125000,
            "currency_code": "IDR",
            "payment_method": "QRIS",
            "description": "Makan siang dengan klien",
        },
        headers=h1,
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "confirmed"

    # 3. Laporan summary
    rep_res = client.get("/api/reports/summary", headers=h1).json()
    assert rep_res["total_expense"] == 125000
    assert rep_res["balance"] == -125000


def test_expense_upload_ai_failure_returns_error(client, monkeypatch):
    u1_token, _ = get_tokens(client)
    h1 = {"Authorization": f"Bearer {u1_token}"}

    def mock_extract_fail(image_bytes, mime_type, available_categories, *args, **kwargs):
        return "failed", {}, {"error": "OPENROUTER_API_KEY tidak valid"}

    import app.routers.expenses as exp_module
    monkeypatch.setattr(exp_module, "extract_expense_from_receipt", mock_extract_fail)

    fake_img = io.BytesIO(b"fake image bytes")
    files = {"file": ("struk2.jpg", fake_img, "image/jpeg")}
    upload_res = client.post("/api/expenses/upload", files=files, headers=h1)
    assert upload_res.status_code == 400
    assert "OPENROUTER_API_KEY tidak valid" in upload_res.json()["detail"]


def test_expense_upload_empty_vendor_defaults_to_lainnya(client, monkeypatch):
    u1_token, _ = get_tokens(client)
    h1 = {"Authorization": f"Bearer {u1_token}"}

    def mock_extract_empty_vendor(image_bytes, mime_type, available_categories, *args, **kwargs):
        return "success", {
            "date": "2026-11-02",
            "vendor": "",  # Vendor kosong
            "total": 50000,
            "currency": "IDR",
            "category": "lainnya",
            "description": "Beli sesuatu tanpa nama toko",
        }, {"mock": True}

    import app.routers.expenses as exp_module
    monkeypatch.setattr(exp_module, "extract_expense_from_receipt", mock_extract_empty_vendor)

    fake_img = io.BytesIO(b"fake receipt with no vendor")
    files = {"file": ("struk_no_vendor.jpg", fake_img, "image/jpeg")}
    upload_res = client.post("/api/expenses/upload", files=files, headers=h1)
    assert upload_res.status_code == 201
    data = upload_res.json()
    assert data["status"] == "draft"
    assert data["party"] == "Lainnya - Periksa lagi Nanti"


def test_approve_all_drafts(client, monkeypatch):
    u1_token, _ = get_tokens(client)
    h1 = {"Authorization": f"Bearer {u1_token}"}
    client.post("/api/categories/seed-defaults", headers=h1)

    def mock_extract(image_bytes, mime_type, available_categories, *args, **kwargs):
        return "success", {
            "date": "2026-11-02",
            "vendor": "Supermarket ABC",
            "total": 75000,
            "currency": "IDR",
            "category": "belanja",
            "description": "Belanja harian",
        }, {"mock": True}

    import app.routers.expenses as exp_module
    monkeypatch.setattr(exp_module, "extract_expense_from_receipt", mock_extract)

    # Upload 2 struk menjadi draft
    client.post("/api/expenses/upload", files={"file": ("s1.jpg", io.BytesIO(b"img1"), "image/jpeg")}, headers=h1)
    client.post("/api/expenses/upload", files={"file": ("s2.jpg", io.BytesIO(b"img2"), "image/jpeg")}, headers=h1)

    # Pastikan ada 2 draft
    drafts = client.get("/api/expenses/drafts", headers=h1).json()
    assert len(drafts) == 2

    # Jalankan approve all
    res = client.post("/api/expenses/drafts/approve-all", headers=h1)
    assert res.status_code == 200
    assert res.json()["approved_count"] == 2

    # Pastikan draft sekarang kosong
    drafts_after = client.get("/api/expenses/drafts", headers=h1).json()
    assert len(drafts_after) == 0

    # Pastikan transaksi masuk ke list confirmed
    txs = client.get("/api/transactions?status=confirmed", headers=h1).json()
    assert len(txs) == 2



