"""
routers/analytics.py

Routes:
  GET   /analytics/dashboard                       — executive KPI summary
  GET   /analytics/teams                           — department health rollups
  GET   /analytics/topics                          — org-wide or per-dept topic sentiment
  GET   /analytics/alerts                          — alert feed
  PATCH /analytics/alerts/{alert_id}/acknowledge   — mark an alert read
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from modules.database import (  # patched as "routers.analytics.*" in tests
    db_acknowledge_alert,
    db_get_alerts,
    db_get_department_aggregates,
    db_get_topic_aggregates,
    db_get_zone_trend,
    get_dashboard_kpis,
)
from modules.recommendations import generate_team_recommendations
from routers.deps import require_any

router = APIRouter(tags=["analytics"])


@router.get("/analytics/dashboard")
async def analytics_dashboard(_: dict = Depends(require_any)):
    kpis               = get_dashboard_kpis()
    kpis["zone_trend"] = db_get_zone_trend()
    return kpis


@router.get("/analytics/teams")
async def get_teams(_: dict = Depends(require_any)):
    """
    Department/team-level health rollups computed from the actual uploaded
    survey data and the latest classifier run.  Each team also gets a short
    list of deterministic, data-grounded recommendations and (if topic data
    exists) a topic sentiment breakdown.
    """
    teams = db_get_department_aggregates()
    for team in teams:
        topic_data          = db_get_topic_aggregates(department=team["department"])
        team["topics"]      = topic_data["topics"]
        team["recommendations"] = generate_team_recommendations(
            {**team, "topics": topic_data["topics"]}
        )
    return {"teams": teams}


@router.get("/analytics/topics")
async def get_topics(
    department: Optional[str] = Query(
        None, description="Filter to a single department; omit for org-wide"
    ),
    _: dict = Depends(require_any),
):
    return db_get_topic_aggregates(department=department)


@router.get("/analytics/alerts")
async def get_alerts(
    acknowledged: Optional[bool] = Query(None),
    limit: int = Query(50),
    _: dict = Depends(require_any),
):
    return {"alerts": db_get_alerts(limit=limit, acknowledged=acknowledged)}


@router.patch("/analytics/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int, user: dict = Depends(require_any)):
    if not db_acknowledge_alert(alert_id, user["username"]):
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "acknowledged"}
