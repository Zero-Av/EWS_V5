"""
tests/test_database.py
Unit tests for the PostgreSQL database operations using a mocked connection.
"""

from unittest.mock import patch, MagicMock
from modules.database import (
    db_get_user,
    db_authenticate_user,
    db_list_users,
    db_create_user,
    db_delete_user,
    db_write_audit_log,
    db_insert_surveys,
    db_get_all_surveys,
    db_get_employee_surveys,
    db_save_classifications,
    db_get_latest_classifications,
    get_dashboard_kpis,
    db_create_alert,
    db_get_alerts,
    db_acknowledge_alert,
)


@patch("modules.database._connect")
def test_db_get_user(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    
    # Mock user row
    mock_cursor.fetchone.return_value = {
        "id": 1,
        "username": "test_user",
        "full_name": "Test User",
        "role": "manager",
        "hashed_password": "hashed_password_value",
        "is_active": 1
    }
    
    user = db_get_user("test_user")
    assert user is not None
    assert user["username"] == "test_user"
    assert user["role"] == "manager"
    assert user["is_active"] is True
    
    mock_cursor.execute.assert_called_once()
    assert "FROM users WHERE username =" in mock_cursor.execute.call_args[0][0]


@patch("modules.database.db_get_user")
def test_db_authenticate_user(mock_get_user):
    from modules.database import _hash_password
    
    mock_get_user.return_value = {
        "id": 1,
        "username": "admin",
        "full_name": "Admin",
        "role": "admin",
        "hashed_password": _hash_password("admin123"),
        "is_active": True
    }
    
    # Successful auth
    auth = db_authenticate_user("admin", "admin123")
    assert auth is not None
    assert auth["username"] == "admin"
    assert "hashed_password" not in auth
    
    # Failed auth (wrong password)
    assert db_authenticate_user("admin", "wrong") is None


@patch("modules.database._connect")
def test_db_create_user(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    
    success = db_create_user("new_user", "password", "New User", "hrbp")
    assert success is True
    mock_cursor.execute.assert_called_once()
    assert "INSERT INTO users" in mock_cursor.execute.call_args[0][0]


@patch("modules.database._connect")
def test_db_delete_user(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    mock_cursor.rowcount = 1
    
    deleted = db_delete_user("old_user")
    assert deleted is True
    mock_cursor.execute.assert_called_once()
    assert "DELETE FROM users WHERE username =" in mock_cursor.execute.call_args[0][0]


@patch("modules.database._connect")
def test_db_write_audit_log(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    
    db_write_audit_log("admin", "test_action", "survey", "123", "details")
    mock_cursor.execute.assert_called_once()
    assert "INSERT INTO audit_log" in mock_cursor.execute.call_args[0][0]


@patch("modules.database._connect")
def test_db_insert_surveys(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    
    surveys = [
        {"employee_id": "EMP001", "survey_date": "2026-01-01", "comments": "Good", "sentiment_score": 0.5, "sentiment_label": "positive"}
    ]
    count = db_insert_surveys(surveys)
    assert count == 1
    mock_cursor.execute.assert_called_once()
    assert "INSERT INTO surveys" in mock_cursor.execute.call_args[0][0]


@patch("modules.database._connect")
def test_db_get_surveys(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    mock_cursor.fetchall.return_value = [
        {"employee_id": "EMP001", "survey_date": "2026-01-01", "comments": "Good"}
    ]
    
    surveys = db_get_all_surveys()
    assert len(surveys) == 1
    assert surveys[0]["employee_id"] == "EMP001"
    
    emp_surveys = db_get_employee_surveys("EMP001")
    assert len(emp_surveys) == 1


@patch("modules.database._connect")
def test_db_save_classifications(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    
    classifications = [
        {"employee_id": "EMP001", "risk_zone": "GREEN", "risk_score": 15.0, "probabilities": {}, "top_factors": []}
    ]
    count = db_save_classifications(classifications)
    assert count == 1
    mock_cursor.execute.assert_called_once()
    assert "INSERT INTO classifications" in mock_cursor.execute.call_args[0][0]


@patch("modules.database._connect")
def test_db_get_latest_classifications(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    mock_cursor.fetchall.return_value = [
        {"employee_id": "EMP001", "risk_zone": "GREEN", "risk_score": 15.0, "probabilities": '{"GREEN": 0.85}', "top_factors": "[]"}
    ]
    
    res = db_get_latest_classifications()
    assert len(res) == 1
    assert res[0]["probabilities"] == {"GREEN": 0.85}


@patch("modules.database._connect")
def test_get_dashboard_kpis(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    
    # Mock two query results (zone distribution and sentiment/coverage)
    mock_cursor.fetchall.return_value = [
        {"risk_zone": "GREEN", "cnt": 5},
        {"risk_zone": "RED", "cnt": 1}
    ]
    mock_cursor.fetchone.return_value = {
        "avg_sentiment": 0.45,
        "employee_count": 6
    }
    
    kpis = get_dashboard_kpis()
    assert kpis["total_employees"] == 6
    assert kpis["pct_red"] == 16.7
    assert kpis["avg_sentiment"] == 0.45
    assert kpis["survey_coverage"] == 6


@patch("modules.database._connect")
def test_db_create_alert(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = {"id": 10}
    
    alert_id = db_create_alert("EMP001", "trend_drop", "warning", "Sentiment dropped", 0.5, 0.1)
    assert alert_id == 10
    mock_cursor.execute.assert_called_once()
    assert "INSERT INTO alerts" in mock_cursor.execute.call_args[0][0]


@patch("modules.database._connect")
def test_db_get_alerts(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    mock_cursor.fetchall.return_value = [
        {"id": 1, "employee_id": "EMP001", "alert_type": "critical"}
    ]
    
    alerts = db_get_alerts(limit=10, acknowledged=False)
    assert len(alerts) == 1
    assert alerts[0]["id"] == 1


@patch("modules.database._connect")
def test_db_acknowledge_alert(mock_connect):
    mock_cursor = MagicMock()
    mock_connect.return_value.cursor.return_value = mock_cursor
    mock_cursor.rowcount = 1
    
    ok = db_acknowledge_alert(1, "admin")
    assert ok is True
    mock_cursor.execute.assert_called_once()
    assert "UPDATE alerts SET acknowledged" in mock_cursor.execute.call_args[0][0]
