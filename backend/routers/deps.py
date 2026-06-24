"""
routers/deps.py — Shared dependencies for all EWS routers.

Exports:
  Schemas     — Token, UserInfo, LLMConnectRequest, AssistantAskRequest,
                AddUserRequest, GenerateRecommendationsRequest,
                UpdateInterventionRequest
  JWT helpers — create_token, SECRET_KEY, ALGORITHM
  FastAPI deps— get_current_user, require_admin, require_any,
                require_manager_or_above
  State       — LLMState (singleton container for the connected LLM)
  Utilities   — _df_from_upload
"""

from __future__ import annotations

import io
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import pandas as pd
from fastapi import Depends, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from modules.database import db_get_user  # patched as "routers.deps.db_get_user" in tests

# ─────────────────────────────────────────────────────────────────────────────
# JWT CONFIG
# ─────────────────────────────────────────────────────────────────────────────
SECRET_KEY           = os.getenv("EWS_SECRET_KEY", secrets.token_hex(32))
ALGORITHM            = "HS256"
TOKEN_EXPIRE_MINUTES = 1440

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str


class UserInfo(BaseModel):
    username: str
    full_name: str
    role: str


class LLMConnectRequest(BaseModel):
    provider: str = "auto"


class AssistantAskRequest(BaseModel):
    message: str


class AddUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str


class GenerateRecommendationsRequest(BaseModel):
    employee_ids: Optional[list[str]] = None  # None → all RED/AMBER employees
    zones: Optional[list[str]] = None         # default ["RED", "AMBER"]
    assign_to_manager: bool = True            # auto-assign to employee's manager_id


class UpdateInterventionRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None


class EmployeeProfileRequest(BaseModel):
    """HRBP-filled point-in-time assessment for one employee.

    Fields match the company's actual EWS data columns.
    ``hrbp_risk_zone`` is a manual override — separate from the AI classifier.
    """
    comments:           Optional[str]   = None
    hrbp_risk_zone:     Optional[str]   = None   # "RED" | "AMBER" | "GREEN" | None
    primary_concern:    Optional[str]   = None   # one of the 16 concern categories
    secondary_reason:   Optional[str]   = None   # secondary concern category
    previous_rag:       Optional[str]   = None   # "GREEN" | "AMBER" | "RED"
    previous_concern:   Optional[str]   = None
    designation:        Optional[str]   = None
    location_region:    Optional[str]   = None   # NCR / Pune / Chennai / Non Iris
    employee_status:    Optional[str]   = None
    total_experience:   Optional[float] = None   # years
    tenure_years:       Optional[float] = None   # years at company
    rating:             Optional[float] = None   # Rating 2025-2026
    ageing:             Optional[float] = None


# ─────────────────────────────────────────────────────────────────────────────
# LLM STATE  — mutable singleton shared across routers
# ─────────────────────────────────────────────────────────────────────────────
class LLMState:
    """Holds the currently connected LangChain LLM instance (or None)."""
    instance = None


# ─────────────────────────────────────────────────────────────────────────────
# JWT HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ─────────────────────────────────────────────────────────────────────────────
# AUTH DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────────
def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    """Validate JWT and return the active user record."""
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        if not username:
            raise cred_exc
    except JWTError:
        raise cred_exc

    user = db_get_user(username)
    if not user or not user.get("is_active", True):
        raise cred_exc
    return user


def require_admin(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    if user["role"] not in ("admin", "hrbp"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_any(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """Any authenticated user."""
    return user


def require_manager_or_above(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """Manager, HRBP, or admin — anyone who can act on interventions."""
    if user["role"] not in ("admin", "hrbp", "manager"):
        raise HTTPException(status_code=403, detail="Manager access required")
    return user


# ─────────────────────────────────────────────────────────────────────────────
# FILE UPLOAD UTILITY
# ─────────────────────────────────────────────────────────────────────────────
def _df_from_upload(file: UploadFile) -> pd.DataFrame:
    """Read an uploaded CSV/Excel file into a DataFrame.

    Supports .csv, .xlsx, and .xls formats.
    """
    content = file.file.read()
    filename = (file.filename or "").lower()
    if filename.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(content))
    return pd.read_csv(io.BytesIO(content))
