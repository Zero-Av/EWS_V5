"""
routers/
Each module owns one feature domain and exports a single `router` instance.
main.py imports and registers them all.
"""
# Relative imports avoid any circular-import risk from absolute `from routers import ...`
from . import (  # noqa: F401 — re-exported for `from routers import auth` in main.py
    auth,
    users,
    llm,
    surveys,
    classification,
    employees,
    interventions,
    analytics,
    training,
)
