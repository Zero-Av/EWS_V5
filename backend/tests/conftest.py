"""
tests/conftest.py
Shared pytest fixtures and mocks for the EWS test suite.
"""

import sys
import pytest
from unittest.mock import MagicMock, patch

# --- Prevent loading real ML models ---
# Mock the transformers pipeline BEFORE importing modules that use them
mock_sentiment_pipe = MagicMock()
# Mock sentiment analysis output: negative, neutral, positive classes with scores
mock_sentiment_pipe.return_value = [
    [
        {"label": "negative", "score": 0.1},
        {"label": "neutral", "score": 0.2},
        {"label": "positive", "score": 0.7}
    ]
]

mock_topic_classifier = MagicMock()
# Mock zero-shot topic detection output
mock_topic_classifier.return_value = {
    "labels": ["manager relationship", "career growth", "workload pressure"],
    "scores": [0.8, 0.5, 0.1]
}

# Apply the patches at the module level so they are active during imports
transformers_patcher = patch("transformers.pipeline")
mock_pipeline_func = transformers_patcher.start()

def side_effect_pipeline(task, *args, **kwargs):
    if task == "sentiment-analysis":
        return mock_sentiment_pipe
    elif task == "zero-shot-classification":
        return mock_topic_classifier
    return MagicMock()

mock_pipeline_func.side_effect = side_effect_pipeline

# Also mock torch/transformers check or loading if needed
sys.modules["transformers"] = MagicMock()

# --- Mock database connections globally ---
# We patch _connect to return a mock connection by default
db_connect_patcher = patch("modules.database._connect")
mock_db_connect = db_connect_patcher.start()

mock_conn = MagicMock()
mock_cursor = MagicMock()
mock_conn.cursor.return_value = mock_cursor
mock_db_connect.return_value = mock_conn

# --- Mock LLM calls globally ---
sys.modules["langchain_anthropic"] = MagicMock()
sys.modules["langchain_ollama"] = MagicMock()
sys.modules["langchain_core"] = MagicMock()


@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset all mock calls before each test."""
    mock_sentiment_pipe.reset_mock()
    mock_topic_classifier.reset_mock()
    mock_conn.reset_mock()
    mock_cursor.reset_mock()
    yield


@pytest.fixture(scope="session")
def client():
    """FastAPI test client."""
    # We must import main after starting patches
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_token(client):
    """JWT token for test authentication."""
    # We mock db_authenticate_user to return admin info
    with patch("main.db_authenticate_user") as mock_auth, \
         patch("main.db_get_user") as mock_get_user, \
         patch("main.db_write_audit_log"):
        
        mock_auth.return_value = {
            "id": 1,
            "username": "admin",
            "full_name": "Admin User",
            "role": "admin",
            "is_active": True
        }
        mock_get_user.return_value = mock_auth.return_value
        
        resp = client.post("/auth/login", data={"username": "admin", "password": "password"})
        assert resp.status_code == 200
        return resp.json()["access_token"]


@pytest.fixture
def admin_headers(auth_token):
    """Headers with Admin Authorization token."""
    return {"Authorization": f"Bearer {auth_token}"}
