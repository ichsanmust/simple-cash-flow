def get_admin_token(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"})
    return res.json()["access_token"]


def test_admin_create_and_manage_user(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Buat user staf
    res = client.post(
        "/api/users",
        json={"username": "budi", "name": "Budi Santoso", "password": "password123", "role": "user"},
        headers=headers,
    )
    assert res.status_code == 201
    user_id = res.json()["id"]
    assert res.json()["username"] == "budi"

    # 2. Login user baru
    login_budi = client.post("/api/auth/login", json={"username": "budi", "password": "password123"})
    assert login_budi.status_code == 200
    budi_token = login_budi.json()["access_token"]

    # 3. User biasa tidak boleh akses /api/users (403)
    forbidden_res = client.get("/api/users", headers={"Authorization": f"Bearer {budi_token}"})
    assert forbidden_res.status_code == 403

    # 4. Admin nonaktifkan user
    deactivate_res = client.patch(f"/api/users/{user_id}", json={"is_active": False}, headers=headers)
    assert deactivate_res.status_code == 200
    assert deactivate_res.json()["is_active"] is False

    # 5. User yang dinonaktifkan tidak bisa login (403)
    login_fail = client.post("/api/auth/login", json={"username": "budi", "password": "password123"})
    assert login_fail.status_code == 403


def test_admin_cannot_deactivate_self(client):
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Ambil profile admin
    me = client.get("/api/auth/me", headers=headers).json()
    admin_id = me["id"]

    res = client.patch(f"/api/users/{admin_id}", json={"is_active": False}, headers=headers)
    assert res.status_code == 400

