"""
routers/users.py

Routes:
  GET    /users              — list all users           (admin)
  POST   /users              — create a new user        (admin)
  DELETE /users/{username}   — deactivate / remove user (admin)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from modules.database import db_list_users, db_create_user, db_delete_user  # patched as "routers.users.*" in tests
from routers.deps import AddUserRequest, require_admin

router = APIRouter(tags=["admin"])


@router.get("/users")
async def list_users(_: dict = Depends(require_admin)):
    return {"users": db_list_users()}


@router.post("/users")
async def add_user(body: AddUserRequest, _: dict = Depends(require_admin)):
    try:
        db_create_user(body.username, body.password, body.full_name, body.role)
        return {"status": "created", "username": body.username}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{username}")
async def remove_user(username: str, _: dict = Depends(require_admin)):
    if not db_delete_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted"}
