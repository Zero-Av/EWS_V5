"""
tests/conftest.py
Shared pytest fixtures and mocks for the EWS test suite.

Patch-target reference after the routers/ refactor:
  Auth       → routers.auth.db_authenticate_user  / routers.auth.db_write_audit_log
  Deps       → routers.deps.db_get_user
  Users      → routers.users.db_list_users / db_create_user / db_delete_user
  Surveys    → routers.surveys.analyze_batch / db_insert_surveys / db_get_all_surveys / summarize_feedback
  Classify   → routers.classification.{db_get_all_surveys, build_features_batch,
                 RAGClassifier, db_save_classifications, db_create_alert, db_get_latest_classifications}
  Employees  → routers.employees.db_get_employee_surveys
  Analytics  → routers.analytics.{get_dashboard_kpis, db_get_alerts, db_acknowledge_alert}
"""

import sys
import pytest
from unittest.mock import MagicMock, patch

# ── Mock ML models before any module imports them ────────────────────────────
mock_sentiment_pipe = MagicMock()
mock_sentiment_pipe.return_value = [
    [
        {"label": "negative", "score": 0.1},
        {"label": "neutral",  "score": 0.2},
        {"label": "positive", "score": 0.7},
    ]
]

mock_topic_classifier = MagicMock()
mock_topic_classifier.return_value = {
    "labels": ["Team", "RO", "Compensation"],
    "scores": [0.8, 0.5, 0.1],
}

transformers_patcher = patch("transformers.pipeline")
mock_pipeline_func   = transformers_patcher.start()


def side_effect_pipeline(task, *args, **kwargs):
    if task == "sentiment-analysis":
        return mock_sentiment_pipe
    if task == "zero-shot-classification":
        return mock_topic_classifier
    return MagicMock()


mock_pipeline_func.side_effect = side_effect_pipeline
sys.modules["transformers"] = MagicMock()

# ── Mock DB connections globally ─────────────────────────────────────────────
db_connect_patcher = patch("modules.database._connect")
mock_db_connect    = db_connect_patcher.start()

mock_conn   = MagicMock()
mock_cursor = MagicMock()
mock_conn.cursor.return_value = mock_cursor
mock_db_connect.return_value  = mock_conn

# ── Mock LLM dependencies ─────────────────────────────────────────────────────
# Sub-packages must be individually registered so that
# `from langchain_core.messages import HumanMessage` resolves at import time.
_langchain_core          = MagicMock()
_langchain_core_messages = MagicMock()
_langchain_core_messages.HumanMessage = MagicMock()

sys.modules["langchain_core"]              = _langchain_core
sys.modules["langchain_core.messages"]     = _langchain_core_messages
sys.modules["langchain_anthropic"]         = MagicMock()
sys.modules["langchain_ollama"]            = MagicMock()


@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset all mock call counts before each test."""
    mock_sentiment_pipe.reset_mock()
    mock_topic_classifier.reset_mock()
    mock_conn.reset_mock()
    mock_cursor.reset_mock()
    yield


@pytest.fixture(scope="session")
def client():
    """FastAPI test client (imports main after patches are live)."""
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_token(client):
    """JWT token for test authentication."""
    # Patch the new router-level locations
    with patch("routers.auth.db_authenticate_user") as mock_auth, \
         patch("routers.deps.db_get_user") as mock_get_user, \
         patch("routers.auth.db_write_audit_log"):

        mock_auth.return_value = {
            "id": 1,
            "username":  "admin",
            "full_name": "Admin User",
            "role":      "admin",
            "is_active": True,
        }
        mock_get_user.return_value = mock_auth.return_value

        resp = client.post("/auth/login", data={"username": "admin", "password": "password"})
        assert resp.status_code == 200
        return resp.json()["access_token"]


@pytest.fixture
def admin_headers(auth_token):
    """Authorization headers, with db_get_user mocked for the full test lifetime.

    Without this, get_current_user would call the real db_get_user which
    returns a MagicMock (from the mocked _connect), causing Pydantic and
    role-check failures.
    """
    with patch("routers.deps.db_get_user") as mock_user:
        mock_user.return_value = {
            "id":        1,
            "username":  "admin",
            "full_name": "Admin User",
            "role":      "admin",
            "is_active": True,
        }
        yield {"Authorization": f"Bearer {auth_token}"}
