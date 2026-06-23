"""
routers/interventions.py

Routes:
  POST   /interventions/generate           — bulk recommendation generation (RED/AMBER)
  GET    /interventions                    — list interventions (scoped by role)
  GET    /interventions/{id}              — get a single intervention
  PATCH  /interventions/{id}              — update status / notes / assignment
  DELETE /interventions/{id}              — remove (admin only)
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from modules.database import (  # patched as "routers.interventions.*" in tests
    db_create_alert,
    db_create_intervention,
    db_delete_intervention,
    db_get_employee_manager,
    db_get_employees_for_manager,
    db_get_intervention,
    db_get_interventions,
    db_get_latest_classifications,
    db_update_intervention,
    db_write_audit_log,
)
from modules.recommendations import generate_recommendation
from routers._helpers import build_employee_payload
from routers.deps import (
    GenerateRecommendationsRequest,
    LLMState,
    UpdateInterventionRequest,
    require_admin,
    require_any,
    require_manager_or_above,
)

router = APIRouter(tags=["interventions"])


@router.post("/interventions/generate")
async def generate_bulk_recommendations(
    body: GenerateRecommendationsRequest,
    user: dict = Depends(require_manager_or_above),
):
    """
    Generate personalised recommendations in bulk.

    Targets every RED/AMBER employee by default; pass ``employee_ids`` to
    narrow to specific people.
    """
    target_ids = body.employee_ids
    if not target_ids:
        zones          = body.zones or ["RED", "AMBER"]
        classifications = db_get_latest_classifications()
        target_ids     = [
            c["employee_id"] for c in classifications if c["risk_zone"] in zones
        ]

    if not target_ids:
        return {
            "status":        "ok",
            "generated":     0,
            "failed":        [],
            "alerts_created": 0,
            "results":       [],
            "message":       "No employees matched the target criteria.",
        }

    results        = []
    alerts_created = 0
    failed         = []

    for employee_id in target_ids:
        try:
            features, classification, recent_comments = build_employee_payload(employee_id)
        except ValueError as e:
            failed.append({"employee_id": employee_id, "error": str(e)})
            continue

        try:
            rec = generate_recommendation(
                employee_id=employee_id,
                features=features,
                classification=classification,
                recent_comments=recent_comments,
                llm=LLMState.instance,
            )
        except Exception as e:
            logger.error(f"[Recommendations] Bulk generation failed for {employee_id}: {e}")
            failed.append({"employee_id": employee_id, "error": str(e)})
            continue

        assigned_to = (
            db_get_employee_manager(employee_id) if body.assign_to_manager else None
        )

        intervention_id = db_create_intervention(
            employee_id=employee_id,
            created_by=user["username"],
            reasoning=rec["reasoning"],
            actions=rec["actions"],
            priority=rec["priority"],
            timeline=rec["timeline"],
            assigned_to=assigned_to,
        )

        if rec["priority"] in ("high", "critical"):
            db_create_alert(
                employee_id,
                "recommendation_generated",
                "critical" if rec["priority"] == "critical" else "warning",
                f"New {rec['priority']} priority recommendation generated for "
                f"{employee_id}: {rec['actions'][0]['title']}",
            )
            alerts_created += 1

        results.append({
            "intervention_id": intervention_id,
            "employee_id":     employee_id,
            "assigned_to":     assigned_to,
            **rec,
        })

    db_write_audit_log(
        user["username"],
        "generate_recommendations_bulk",
        "intervention",
        details=f"{len(results)} generated",
    )

    return {
        "status":        "ok",
        "generated":     len(results),
        "failed":        failed,
        "alerts_created": alerts_created,
        "results":       results,
    }


@router.get("/interventions")
async def list_interventions(
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    mine: bool = Query(False, description="Only interventions assigned to the current user"),
    limit: int = Query(100),
    user: dict = Depends(require_any),
):
    """
    List interventions.  Managers are automatically scoped to their direct
    reports; admins/HRBP see everything by default.
    """
    manager_scope = None
    assigned_to   = user["username"] if mine else None

    if not employee_id and user["role"] == "manager":
        manager_scope = db_get_employees_for_manager(user["username"])

    interventions = db_get_interventions(
        employee_id=employee_id,
        assigned_to=assigned_to,
        manager_employee_ids=manager_scope,
        status=status,
        limit=limit,
    )
    return {"interventions": interventions}


@router.get("/interventions/{intervention_id}")
async def get_intervention_by_id(intervention_id: int, _: dict = Depends(require_any)):
    intervention = db_get_intervention(intervention_id)
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return intervention


@router.patch("/interventions/{intervention_id}")
async def update_intervention(
    intervention_id: int,
    body: UpdateInterventionRequest,
    user: dict = Depends(require_manager_or_above),
):
    """Update status, notes, assignment, priority, or due date."""
    if not db_get_intervention(intervention_id):
        raise HTTPException(status_code=404, detail="Intervention not found")

    updated = db_update_intervention(
        intervention_id,
        status=body.status,
        notes=body.notes,
        assigned_to=body.assigned_to,
        priority=body.priority,
        due_date=body.due_date,
    )
    if not updated:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    db_write_audit_log(user["username"], "update_intervention", "intervention", str(intervention_id))
    return {"status": "updated", "intervention_id": intervention_id}


@router.delete("/interventions/{intervention_id}")
async def delete_intervention(intervention_id: int, user: dict = Depends(require_admin)):
    if not db_delete_intervention(intervention_id):
        raise HTTPException(status_code=404, detail="Intervention not found")
    db_write_audit_log(user["username"], "delete_intervention", "intervention", str(intervention_id))
    return {"status": "deleted"}
