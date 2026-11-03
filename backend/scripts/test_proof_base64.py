import requests
import json
import base64

# 1. Login as driver1
login_res = requests.post(
    "http://127.0.0.1:8000/api/auth/login",
    json={"email": "driver1@gmail.com", "password": "driver123"},
)
print("Login status:", login_res.status_code)
tokens = login_res.json()
token = tokens.get("access_token")
print("Token acquired:", bool(token))

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}

# 2. Get today's route
route_res = requests.get("http://127.0.0.1:8000/api/driver/routes/today", headers=headers)
print("Route status:", route_res.status_code)
route_data = route_res.json()
route_id = route_data["id"]
stops = route_data["stops"]
print(f"Route ID {route_id} has {len(stops)} stops")

active_stop = None
for s in stops:
    if s["execution_status"] in ["ARRIVED", "IN_PROGRESS"]:
        active_stop = s
        break

if not active_stop:
    active_stop = stops[0]

stop_id = active_stop["id"]
print(f"Testing proof upload for stop {stop_id} (status={active_stop['execution_status']})")

# 3. Create sample 1x1 JPEG base64
jpeg_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00\xFF\xC0\x00\x0B\x08\x00\x01\x00\x01\x01\x01\x11\x00\xFF\xC4\x00\x1F\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xFF\xDA\x00\x08\x01\x01\x00\x00?\x00\xBF\x00\xFF\xD9"
b64 = "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode("ascii")

# 4. Upload to proof-base64 via proxy port 8001
proof_res = requests.post(
    f"http://127.0.0.1:8001/api/driver/routes/{route_id}/stops/{stop_id}/proof-base64",
    headers=headers,
    json={"image_base64": b64, "file_name": "test_proof.jpg"},
)
print("Proxy Proof upload status:", proof_res.status_code)
print("Response:", proof_res.text)

