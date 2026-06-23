"""
main.py — EWS v5 FastAPI Backend
Slim entry point: app factory, middleware, startup, health check.

All route logic lives in routers/:
  routers/auth.py            → /auth/*
  routers/users.py           → /users
  routers/llm.py             → /llm/*, /assistant/ask
  routers/surveys.py         → /surveys/*
  routers/classification.py  → /classify, /classifications
  routers/employees.py       → /employees/*
  routers/interventions.py   → /interventions/*
  routers/analytics.py       → /analytics/*
  routers/training.py        → /train, /model/info
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from modules.database import init_db, _connect
from modules.scheduler import init_scheduler

from routers import auth, users, llm, surveys, classification, employees, interventions, analytics, training

# ─────────────────────────────────────────────────────────────────────────────
# APP FACTORY
# ─────────────────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app = FastAPI(title="EWS API", version="5.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logger.add(
    "logs/ews.log",
    rotation="20 MB",
    retention="14 days",
    level="INFO",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
)

# ─────────────────────────────────────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────────────────────────────────────
logger.info("Initializing database…")
init_db()
logger.info("Database initialized.")
init_scheduler()


# ─────────────────────────────────────────────────────────────────────────────
# MIDDLEWARE
# ─────────────────────────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start    = time.time()
    response = await call_next(request)
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} "
        f"({time.time() - start:.3f}s)"
    )
    return response


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check():
    try:
        conn = _connect()
        conn.cursor().execute("SELECT 1")
        conn.close()
        return {"status": "up", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTERS
# ─────────────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(llm.router)
app.include_router(surveys.router)
app.include_router(classification.router)
app.include_router(employees.router)
app.include_router(interventions.router)
app.include_router(analytics.router)
app.include_router(training.router)
