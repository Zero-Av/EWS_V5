import sys
import os
import json
from fastapi.testclient import TestClient

# Make sure we are in the backend directory
sys.path.append(os.path.dirname(__file__))

from main import app
from modules.database import _connect, init_db

print("=== 1. Initializing Database ===")
init_db()

client = TestClient(app)

print("=== 2. Authenticating as Admin ===")
resp = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
if resp.status_code != 200:
    print("Failed to login as admin:", resp.text)
    sys.exit(1)
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("Successfully authenticated as admin.")

print("\n=== 3. Uploading Sample - EWS.xlsx and Training Model ===")
sample_file_path = r"../Sample - EWS.xlsx"

if not os.path.exists(sample_file_path):
    print(f"Error: Sample file not found at {sample_file_path}")
    sys.exit(1)

with open(sample_file_path, "rb") as f:
    resp = client.post(
        "/train",
        headers=headers,
        files={"file": ("Sample - EWS.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )

if resp.status_code == 200:
    print("Training Successful!")
    print(json.dumps(resp.json(), indent=2))
else:
    print("Training Failed!")
    print(resp.text)
    sys.exit(1)

print("\n=== 4. Fetching an Employee to Test Prediction ===")
conn = _connect()
cur = conn.cursor()
cur.execute("SELECT employee_id FROM surveys LIMIT 1")
row = cur.fetchone()
conn.close()

if not row:
    print("No employees found in the DB. Training might have failed to insert records.")
    sys.exit(1)

emp_id = row["employee_id"]
print(f"Testing manual classification for Employee ID: {emp_id}")

payload = {
    "comments": "The workload has been okay recently, but I still feel like the team dynamics could be better. Also, my compensation feels a bit low for the market.",
    "primary_concern": "Compensation",
    "total_experience": 5,
    "tenure_years": 2.5,
    "rating": 4,
    "ageing": 1,
    "previous_rag": "AMBER",
    "designation": "Software Engineer",
    "secondary_reason": "Career Progression"
}

resp = client.post(
    f"/employees/{emp_id}/classify-manual",
    headers=headers,
    json=payload
)

if resp.status_code == 200:
    print("Prediction Successful!")
    print(json.dumps(resp.json(), indent=2))
else:
    print("Prediction Failed!")
    print(resp.text)
