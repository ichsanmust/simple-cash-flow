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


def test_user_category_isolation_and_check(client):
    u1_token, u2_token = get_tokens(client)
    h1 = {"Authorization": f"Bearer {u1_token}"}
    h2 = {"Authorization": f"Bearer {u2_token}"}

    # 1. User baru mulai dengan 0 kategori
    check_u1 = client.get("/api/categories/check", headers=h1).json()
    assert check_u1["has_categories"] is False
    assert check_u1["count"] == 0

    cats_u1 = client.get("/api/categories", headers=h1).json()
    assert len(cats_u1) == 0

    # 2. User 1 seed kategori default
    seed_res = client.post("/api/categories/seed-defaults", headers=h1)
    assert seed_res.status_code == 200
    cats_seeded = seed_res.json()
    assert len(cats_seeded) > 0

    # User 1 sekarang memiliki kategori
    check_u1_after = client.get("/api/categories/check", headers=h1).json()
    assert check_u1_after["has_categories"] is True
    assert check_u1_after["count"] == len(cats_seeded)
    assert check_u1_after["income_count"] > 0
    assert check_u1_after["expense_count"] > 0

    # 3. User 2 tetap 0 kategori (Isolasi data antar user)
    check_u2 = client.get("/api/categories/check", headers=h2).json()
    assert check_u2["has_categories"] is False
    assert check_u2["count"] == 0

    cats_u2 = client.get("/api/categories", headers=h2).json()
    assert len(cats_u2) == 0


def test_category_crud_and_validation(client):
    u1_token, u2_token = get_tokens(client)
    h1 = {"Authorization": f"Bearer {u1_token}"}
    h2 = {"Authorization": f"Bearer {u2_token}"}

    # 1. User 1 buat kategori custom
    res = client.post(
        "/api/categories",
        json={"name": "Kopi & Nongkrong", "type": "expense"},
        headers=h1,
    )
    assert res.status_code == 201
    cat_data = res.json()
    assert cat_data["name"] == "kopi & nongkrong"
    assert cat_data["type"] == "expense"
    cat_id = cat_data["id"]

    # Duplikat nama kategori
    dup_res = client.post(
        "/api/categories",
        json={"name": "Kopi & Nongkrong", "type": "expense"},
        headers=h1,
    )
    assert dup_res.status_code == 400

    # 2. User 1 ubah kategori (PATCH)
    patch_res = client.patch(
        f"/api/categories/{cat_id}",
        json={"name": "Cafe & Kopi", "is_active": False},
        headers=h1,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "cafe & kopi"
    assert patch_res.json()["is_active"] is False

    # User 2 tidak bisa ubah kategori User 1
    patch_fail = client.patch(
        f"/api/categories/{cat_id}",
        json={"name": "Hacked"},
        headers=h2,
    )
    assert patch_fail.status_code == 404

    # 3. User 2 tidak bisa hapus kategori User 1
    del_fail = client.delete(f"/api/categories/{cat_id}", headers=h2)
    assert del_fail.status_code == 404

    # 4. User 1 menghapus kategori (belum dipakai di transaksi)
    del_res = client.delete(f"/api/categories/{cat_id}", headers=h1)
    assert del_res.status_code == 200

    # Pastikan sudah terhapus
    check_deleted = client.patch(f"/api/categories/{cat_id}", json={"name": "New"}, headers=h1)
    assert check_deleted.status_code == 404


def test_category_cannot_delete_if_in_use(client):
    u1_token, _ = get_tokens(client)
    h1 = {"Authorization": f"Bearer {u1_token}"}

    # User 1 buat kategori pemasukan
    res = client.post(
        "/api/categories",
        json={"name": "Proyek Website", "type": "income"},
        headers=h1,
    )
    assert res.status_code == 201
    cat_id = res.json()["id"]

    # Buat transaksi pemasukan menggunakan kategori ini
    trx_res = client.post(
        "/api/incomes",
        data={
            "trx_date": "2026-11-02",
            "party": "Client ABC",
            "category_id": cat_id,
            "amount": 2500000,
            "currency_code": "IDR",
        },
        headers=h1,
    )
    assert trx_res.status_code == 201

    # Coba hapus kategori -> harus gagal karena dipakai transaksi
    del_res = client.delete(f"/api/categories/{cat_id}", headers=h1)
    assert del_res.status_code == 400
    assert "telah digunakan pada 1 transaksi" in del_res.json()["detail"]
