def test_system_settings_crud(client):
    admin_login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"},
    )
    assert admin_login.status_code == 200
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get settings
    res = client.get("/api/settings", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["ai_daily_limit_per_user"] == 20
    assert data["upload_dir"] == "uploads"
    assert data["max_upload_mb"] == 5

    # 2. Update settings
    update_res = client.post(
        "/api/settings",
        json={
            "ai_daily_limit_per_user": 50,
            "max_upload_mb": 10,
            "upload_dir": "storage_custom",
        },
        headers=headers,
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["ai_daily_limit_per_user"] == 50
    assert updated_data["max_upload_mb"] == 10
    assert updated_data["upload_dir"] == "storage_custom"

    # 3. Verifikasi GET kembali
    res2 = client.get("/api/settings", headers=headers)
    assert res2.json()["ai_daily_limit_per_user"] == 50


def test_regular_user_cannot_access_settings(client):
    # Buat user biasa
    admin_login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"},
    )
    admin_token = admin_login.json()["access_token"]
    client.post(
        "/api/users",
        json={"username": "staf_settings", "password": "password123", "name": "Staf", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    user_login = client.post("/api/auth/login", json={"username": "staf_settings", "password": "password123"})
    user_token = user_login.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    res_get = client.get("/api/settings", headers=user_headers)
    assert res_get.status_code == 403

    res_post = client.post("/api/settings", json={"max_upload_mb": 20}, headers=user_headers)
    assert res_post.status_code == 403

