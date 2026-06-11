"""
tests/test_api.py
Integration tests for EWS v5 FastAPI endpoints.
All database operations and ML models are mocked.
"""

from unittest.mock import patch, MagicMock
import io
import pandas as pd


def test_health_check(client):
    with patch("main.db_get_user") as mock_get:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "up"
        assert "timestamp" in data


def test_unauthorized_access(client):
    # Protected endpoint should return 401
    response = client.get("/users")
    assert response.status_code == 401


def test_login_failure(client):
    with patch("main.db_authenticate_user", return_value=None):
        response = client.post("/auth/login", data={"username": "wrong", "password": "wrong"})
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]


def test_auth_me(client, admin_headers):
    response = client.get("/auth/me", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_list_users(client, admin_headers):
    mock_users = [{"username": "admin", "full_name": "Admin", "role": "admin", "is_active": True}]
    with patch("main.db_list_users", return_value=mock_users):
        response = client.get("/users", headers=admin_headers)
        assert response.status_code == 200
        assert len(response.json()["users"]) == 1


def test_add_user(client, admin_headers):
    with patch("main.db_create_user", return_value=True):
        response = client.post(
            "/users",
            json={"username": "new_mgr", "password": "password123", "full_name": "New Manager", "role": "manager"},
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "created"


def test_remove_user(client, admin_headers):
    with patch("main.db_delete_user", return_value=True):
        response = client.delete("/users/new_mgr", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    with patch("main.db_delete_user", return_value=False):
        response = client.delete("/users/nonexistent", headers=admin_headers)
        assert response.status_code == 404


def test_llm_connect_and_status(client, admin_headers):
    with patch("modules.llm.get_llm") as mock_get_llm:
        mock_get_llm.return_value = MagicMock()
        response = client.post("/llm/connect", json={"provider": "ollama"}, headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "connected"

        # Check status
        status_resp = client.get("/llm/status", headers=admin_headers)
        assert status_resp.status_code == 200
        assert status_resp.json()["connected"] is True


@patch("main.analyze_batch")
@patch("main.db_insert_surveys")
def test_upload_surveys(mock_db_insert, mock_analyze_batch, client, admin_headers):
    # Mock sentiment analysis
    mock_analyze_batch.return_value = [
        {"score": 0.5, "label": "positive", "probabilities": {}}
    ]
    mock_db_insert.return_value = 1

    csv_data = "employee_id,survey_date,comments\nEMP001,2026-06-12,I feel great\n"
    file = io.BytesIO(csv_data.encode("utf-8"))
    
    response = client.post(
        "/surveys/upload",
        files={"file": ("surveys.csv", file, "text/csv")},
        data={"run_topics": "false"},
        headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["surveys_ingested"] == 1


@patch("main.db_get_all_surveys")
@patch("main.summarize_feedback")
def test_summarize_surveys(mock_summarize, mock_get_surveys, client, admin_headers):
    mock_get_surveys.return_value = [
        {"comments": "Workload is too high!", "sentiment_score": -0.5}
    ]
    mock_summarize.return_value = "Summary of workload issues."

    response = client.post("/surveys/summarize", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["summary"] == "Summary of workload issues."


@patch("main.db_get_all_surveys")
@patch("main.build_features_batch")
@patch("main.RAGClassifier")
@patch("main.db_save_classifications")
@patch("main.db_create_alert")
def test_classify_employees(mock_create_alert, mock_save_class, mock_clf_class, mock_build_features, mock_get_surveys, client, admin_headers):
    mock_get_surveys.return_value = [{"employee_id": "EMP001"}]
    mock_build_features.return_value = pd.DataFrame([{"employee_id": "EMP001"}])
    
    # Mock RAGClassifier
    mock_clf = MagicMock()
    mock_clf_class.return_value = mock_clf
    mock_clf.load.return_value = True
    mock_clf.predict.return_value = [
        {"employee_id": "EMP001", "risk_zone": "RED", "risk_score": 85.0}
    ]
    
    mock_save_class.return_value = 1

    response = client.post("/classify", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["employees_classified"] == 1
    assert response.json()["alerts_created"] == 1
    mock_create_alert.assert_called_once()


@patch("main.db_get_latest_classifications")
def test_get_classifications(mock_get_class, client, admin_headers):
    mock_get_class.return_value = [
        {"employee_id": "EMP001", "risk_zone": "RED", "risk_score": 85.0}
    ]
    response = client.get("/classifications", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()["classifications"]) == 1


@patch("main.db_get_employee_surveys")
def test_employee_sentiment(mock_get_surveys, client, admin_headers):
    mock_get_surveys.return_value = [
        {"survey_date": "2026-06-01", "sentiment_score": 0.5, "sentiment_label": "positive", "comments": "Nice", "topics_json": "{}"}
    ]
    response = client.get("/employees/EMP001/sentiment", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["employee_id"] == "EMP001"
    assert data["survey_count"] == 1


@patch("main.get_dashboard_kpis")
def test_analytics_dashboard(mock_kpis, client, admin_headers):
    mock_kpis.return_value = {"total_employees": 10}
    response = client.get("/analytics/dashboard", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["total_employees"] == 10


@patch("main.db_get_alerts")
def test_get_alerts(mock_alerts, client, admin_headers):
    mock_alerts.return_value = [{"id": 1, "employee_id": "EMP001"}]
    response = client.get("/analytics/alerts", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()["alerts"]) == 1


@patch("main.db_acknowledge_alert")
def test_acknowledge_alert(mock_ack, client, admin_headers):
    mock_ack.return_value = True
    response = client.patch("/analytics/alerts/1/acknowledge", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "acknowledged"


def test_model_info(client, admin_headers):
    response = client.get("/model/info", headers=admin_headers)
    # Even if file doesn't exist, it should return status code 200 with has_model=False
    assert response.status_code == 200
    assert "has_model" in response.json()
