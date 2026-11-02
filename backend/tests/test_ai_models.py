def test_ai_models_crud_and_activation(client):
    # 1. Login sebagai Admin
    admin_login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"},
    )
    assert admin_login.status_code == 200
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get active model (endpoint publik untuk user login)
    res_act = client.get("/api/ai-models/active", headers=headers)
    assert res_act.status_code == 200
    act_data = res_act.json()
    assert act_data["model_id"] == "google/gemini-2.5-flash"

    # 3. List models & settings (Admin only)
    res_list = client.get("/api/ai-models", headers=headers)
    assert res_list.status_code == 200
    data = res_list.json()
    assert len(data["models"]) >= 7
    assert data["settings"]["active_model_id"] == "google/gemini-2.5-flash"

    # 4. Tambah model kustom
    res_create = client.post(
        "/api/ai-models",
        json={
            "name": "Mistral Large 2",
            "model_id": "mistralai/mistral-large-2407",
            "provider": "OpenRouter",
            "description": "Model flagship dari Mistral AI",
        },
        headers=headers,
    )
    assert res_create.status_code == 201
    new_model = res_create.json()
    assert new_model["model_id"] == "mistralai/mistral-large-2407"
    assert new_model["is_custom"] is True

    # 5. Aktifkan model kustom tersebut
    res_activate = client.post(
        f"/api/ai-models/{new_model['id']}/activate",
        headers=headers,
    )
    assert res_activate.status_code == 200

    # Verifikasi active model berubah
    res_act2 = client.get("/api/ai-models/active", headers=headers)
    assert res_act2.json()["model_id"] == "mistralai/mistral-large-2407"

    # 6. Update API key OpenRouter ke database
    res_set = client.post(
        "/api/ai-models/settings",
        json={"openrouter_api_key": "sk-or-v1-testkey123456789"},
        headers=headers,
    )
    assert res_set.status_code == 200

    # Verifikasi key tersimpan (termasking saat di-GET)
    res_list2 = client.get("/api/ai-models", headers=headers)
    assert res_list2.json()["settings"]["has_openrouter_api_key"] is True
    assert "sk-or-v1" in res_list2.json()["settings"]["openrouter_api_key_masked"]


def test_regular_user_cannot_manage_ai_models(client):
    # Buat user biasa melalui admin
    admin_login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"},
    )
    admin_token = admin_login.json()["access_token"]

    client.post(
        "/api/users",
        json={"username": "staf_biasa", "password": "password123", "name": "Staf", "role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Login user biasa
    user_login = client.post("/api/auth/login", json={"username": "staf_biasa", "password": "password123"})
    user_token = user_login.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Boleh melihat active model
    res1 = client.get("/api/ai-models/active", headers=user_headers)
    assert res1.status_code == 200

    # Tidak boleh akses daftar model & pengaturan
    res2 = client.get("/api/ai-models", headers=user_headers)
    assert res2.status_code == 403

    # Tidak boleh ganti model
    res3 = client.post("/api/ai-models/1/activate", headers=user_headers)
    assert res3.status_code == 403

