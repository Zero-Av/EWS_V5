"""
tests/test_interventions.py
CRUD tests for the /interventions endpoints.
"""
import pytest


def test_list_interventions_requires_auth(client):
    """Unauthenticated requests are rejected."""
    resp = client.get("/interventions")
    assert resp.status_code == 401


def test_list_interventions(client, admin_headers):
    """Admin can list interventions (empty list is fine on a fresh DB)."""
    resp = client.get("/interventions", headers=admin_headers)
    assert resp.status_code == 200
    assert "interventions" in resp.json()
    assert isinstance(resp.json()["interventions"], list)


def test_create_intervention(client, admin_headers):
    """Admin can create an intervention record."""
    payload = {
        "employee_id": "TEST-EMP-001",
        "assigned_to": "manager",
        "priority": "High",
        "timeline": "2 weeks",
        "reasoning": "High stress levels detected.",
        "actions": ["1:1 meeting", "workload review"],
        "due_date": "2026-12-31",
    }
    resp = client.post("/interventions", json=payload, headers=admin_headers)
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "intervention_id" in data
    return data["interventions_id"]


def test_update_intervention_status(client, admin_headers):
    """Admin can update an intervention status."""
    # Create one first
    payload = {
        "employee_id": "TEST-EMP-002",
        "assigned_to": "manager",
        "priority": "Medium",
        "timeline": "1 month",
        "reasoning": "Satisfaction drop.",
        "actions": ["survey follow-up"],
    }
    create_resp = client.post("/interventions", json=payload, headers=admin_headers)
    assert create_resp.status_code in (200, 201)
    intervention_id = create_resp.json()["intervention_id"]

    # Update its status
    update_resp = client.patch(
        f"/interventions/{intervention_id}/status",
        json={"status": "In Progress", "note": "Started conversation with employee."},
        headers=admin_headers,
    )
    assert update_resp.status_code == 200
