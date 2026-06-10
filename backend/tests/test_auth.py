"""
tests/test_auth.py
Authentication and authorisation tests.
"""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_check():
    """Health endpoint returns the correct shape and database probe passes."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "up"
    assert data["database"] == "ok"
    assert "timestamp" in data


def test_unauthorized_access():
    """Protected endpoints reject unauthenticated requests."""
    response = client.get("/analytics/dashboard")
    assert response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]


def test_login_failure():
    """Wrong credentials return 401."""
    response = client.post(
        "/auth/login",
        data={"username": "fake_user", "password": "wrong_password"},
    )
    assert response.status_code == 401


def test_login_success(auth_token):
    """Valid credentials return a JWT token."""
    assert auth_token is not None
    assert isinstance(auth_token, str)
    assert len(auth_token) > 20


def test_auth_me(client, auth_token):
    """Authenticated /auth/me returns the current user's info."""
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {auth_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"
