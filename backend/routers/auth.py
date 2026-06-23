"""
routers/auth.py

Routes:
  POST /auth/login   — exchange credentials for JWT
  GET  /auth/me      — return the current user's profile
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from modules.database import db_authenticate_user, db_write_audit_log  # patched as "routers.auth.*" in tests
from routers.deps import Token, UserInfo, create_token, get_current_user

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = db_authenticate_user(form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_token({"sub": user["username"], "role": user["role"]})
    db_write_audit_log(user["username"], "login", "auth")
    return Token(
        access_token=token,
        token_type="bearer",
        role=user["role"],
        full_name=user["full_name"],
    )


@router.get("/auth/me", response_model=UserInfo)
async def me(user: dict = Depends(get_current_user)):
    return UserInfo(**{k: user[k] for k in ("username", "full_name", "role")})
