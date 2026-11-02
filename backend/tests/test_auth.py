def test_login_success(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"


def test_login_wrong_password(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert res.status_code == 401


def test_get_me(client):
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"})
    token = login_res.json()["access_token"]

    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["username"] == "admin"


def test_change_password(client):
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "8dkBQkXLM14Ad454nT7u*47k"})
    token = login_res.json()["access_token"]

    res = client.post(
        "/api/auth/change-password",
        json={"old_password": "8dkBQkXLM14Ad454nT7u*47k", "new_password": "newadminpassword123"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200

    # Cek login pakai password baru
    login2 = client.post("/api/auth/login", json={"username": "admin", "password": "newadminpassword123"})
    assert login2.status_code == 200

