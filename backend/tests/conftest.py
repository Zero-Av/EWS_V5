"""
tests/conftest.py
Shared pytest fixtures for the EWS test suite.
"""
import pytest
from fastapi.testclient import TestClient
from main import app
from modules.database import init_db


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Initialise all tables once per test session."""
    init_db()


@pytest.fixture(scope="module")
def client():
    """FastAPI test client — reused across tests in the same module."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth_token(client):
    """JWT token for the default admin user — reused across tests in the same module."""
    resp = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(auth_token):
    """Authorization headers for admin requests."""
    return {"Authorization": f"Bearer {auth_token}"}
