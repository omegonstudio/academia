#!/usr/bin/env bash
# Web + auth smoke against the development Compose stack.
#
# Prerequisites:
#   - .env with SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD (never printed)
#   - stack up via `npm run dev` or `docker compose up -d --build`
#
# Checks (same-origin via Next rewrite where applicable):
#   1. API health (/api/health)
#   2. Web home
#   3. Login → session cookie
#   4. /auth/me
#   5. /dashboard (session)
#   6. /dashboard/membership (session)
#   7. Logout
#   8. /auth/me → 401
#
# Does not invent credentials, payments, or a DEV auth bypass.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env. Create it with:  cp .env.example .env" >&2
  exit 1
fi

# Load only the keys we need (no `source` — values may contain spaces).
env_get() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" .env | tail -n 1 || true)"
  printf '%s' "${line#"${key}="}"
}

WEB_PORT_VALUE="${WEB_PORT:-$(env_get WEB_PORT)}"
WEB_PORT_VALUE="${WEB_PORT_VALUE:-3000}"
BASE_URL="http://127.0.0.1:${WEB_PORT_VALUE}"
API_REWRITE="${BASE_URL}/api"


SUPERADMIN_EMAIL="$(env_get SUPERADMIN_EMAIL)"
SUPERADMIN_PASSWORD="$(env_get SUPERADMIN_PASSWORD)"

if [[ -z "$SUPERADMIN_EMAIL" || -z "$SUPERADMIN_PASSWORD" ]]; then
  echo "SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in .env for smoke." >&2
  exit 1
fi

COOKIE_JAR="$(mktemp)"
cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

wait_http_ok() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local i code

  for ((i = 1; i <= attempts; i++)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$code" == "200" ]]; then
      echo "PASS  ${label} (${url})"
      return 0
    fi
    sleep 2
  done

  echo "FAIL  ${label} did not return 200 (${url}, last=${code:-none})" >&2
  return 1
}

echo "==> Waiting for API + Web"
wait_http_ok "${API_REWRITE}/health" "API health via rewrite"
wait_http_ok "${BASE_URL}/" "Web home"

echo "==> Login"
login_code="$(
  curl -s -o /tmp/academia-smoke-login.json -w '%{http_code}' \
    -c "$COOKIE_JAR" \
    -X POST "${API_REWRITE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SUPERADMIN_EMAIL}\",\"password\":\"${SUPERADMIN_PASSWORD}\"}"
)"
if [[ "$login_code" != "200" ]]; then
  echo "FAIL  login returned ${login_code}" >&2
  exit 1
fi
if ! grep -q academia_session "$COOKIE_JAR"; then
  echo "FAIL  login did not set academia_session cookie" >&2
  exit 1
fi
python3 - <<'PY'
import json
user = json.load(open("/tmp/academia-smoke-login.json"))["user"]
assert user.get("id") and user.get("email") and user.get("role")
print(f"PASS  login ({user['role']})")
PY

echo "==> Session"
me_code="$(
  curl -s -o /tmp/academia-smoke-me.json -w '%{http_code}' \
    -b "$COOKIE_JAR" \
    "${API_REWRITE}/auth/me"
)"
if [[ "$me_code" != "200" ]]; then
  echo "FAIL  /auth/me returned ${me_code}" >&2
  exit 1
fi
echo "PASS  /auth/me"

echo "==> Dashboard (authenticated)"
dash="$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/dashboard")"
if echo "$dash" | grep -q 'NEXT_REDIRECT;replace;/login'; then
  echo "FAIL  /dashboard redirected to login with a valid session" >&2
  exit 1
fi
echo "PASS  /dashboard"

echo "==> Membership (authenticated)"
memb="$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/dashboard/membership")"
if echo "$memb" | grep -q 'NEXT_REDIRECT;replace;/login'; then
  echo "FAIL  /dashboard/membership redirected to login with a valid session" >&2
  exit 1
fi
# Client page: accept either HTML copy or the membership client chunk reference.
if ! echo "$memb" | grep -Eq 'membership|Membership|Nivel Plata|Membresía'; then
  echo "FAIL  /dashboard/membership payload did not look like the membership page" >&2
  exit 1
fi
echo "PASS  /dashboard/membership"

echo "==> Finance settings + page (authenticated)"
fin_settings_code="$(
  curl -s -o /tmp/academia-smoke-finance-settings.json -w '%{http_code}' \
    -b "$COOKIE_JAR" \
    "${API_REWRITE}/finance/settings"
)"
if [[ "$fin_settings_code" != "200" ]]; then
  echo "FAIL  GET /finance/settings returned ${fin_settings_code}" >&2
  exit 1
fi
python3 - <<'PY'
import json
body = json.load(open("/tmp/academia-smoke-finance-settings.json"))
settings = body["settings"]
assert settings["academyPercentage"] in (20, 30, 40, 50)
assert settings["teacherPercentage"] == 100 - settings["academyPercentage"]
print(f"PASS  /finance/settings ({settings['academyPercentage']}/{settings['teacherPercentage']})")
PY

fin_page_code="$(
  curl -s -o /tmp/academia-smoke-finance-page.html -w '%{http_code}' \
    -b "$COOKIE_JAR" \
    "${BASE_URL}/dashboard/finance"
)"
if [[ "$fin_page_code" != "200" ]]; then
  echo "FAIL  /dashboard/finance returned ${fin_page_code}" >&2
  exit 1
fi
fin_page="$(cat /tmp/academia-smoke-finance-page.html)"
if echo "$fin_page" | grep -q 'NEXT_REDIRECT;replace;/login'; then
  echo "FAIL  /dashboard/finance redirected to login with a valid session" >&2
  exit 1
fi
# Client page: accept HTML copy or the finance client chunk/path reference.
if ! echo "$fin_page" | grep -Eq 'finance|Finanzas|Split academia|academyPercentage'; then
  echo "FAIL  /dashboard/finance payload did not look like the finance page" >&2
  exit 1
fi
echo "PASS  /dashboard/finance"

fin_charges_code="$(
  curl -s -o /tmp/academia-smoke-finance-charges.json -w '%{http_code}' \
    -b "$COOKIE_JAR" \
    "${API_REWRITE}/finance/charges"
)"
if [[ "$fin_charges_code" != "200" ]]; then
  echo "FAIL  GET /finance/charges returned ${fin_charges_code}" >&2
  exit 1
fi
echo "PASS  /finance/charges"

fin_payments_code="$(
  curl -s -o /dev/null -w '%{http_code}' \
    -b "$COOKIE_JAR" \
    "${API_REWRITE}/finance/payments"
)"
if [[ "$fin_payments_code" != "200" ]]; then
  echo "FAIL  GET /finance/payments returned ${fin_payments_code}" >&2
  exit 1
fi
echo "PASS  /finance/payments"

fin_alloc_code="$(
  curl -s -o /dev/null -w '%{http_code}' \
    -b "$COOKIE_JAR" \
    "${API_REWRITE}/finance/allocations"
)"
if [[ "$fin_alloc_code" != "200" ]]; then
  echo "FAIL  GET /finance/allocations returned ${fin_alloc_code}" >&2
  exit 1
fi
echo "PASS  /finance/allocations"

fin_settle_code="$(
  curl -s -o /dev/null -w '%{http_code}' \
    -b "$COOKIE_JAR" \
    "${API_REWRITE}/finance/settlements"
)"
if [[ "$fin_settle_code" != "200" ]]; then
  echo "FAIL  GET /finance/settlements returned ${fin_settle_code}" >&2
  exit 1
fi
echo "PASS  /finance/settlements"

echo "==> Auto-charge ONE_TO_ONE → OPEN charge (checkout in Student Hub)"
SMOKE_TS="$(date -u +%Y%m%d%H%M%S)"
python3 - "$API_REWRITE" "$COOKIE_JAR" "$SMOKE_TS" <<'PY'
import json, sys, urllib.request, http.cookiejar, datetime

api, jar_path, stamp = sys.argv[1], sys.argv[2], sys.argv[3]
jar = http.cookiejar.MozillaCookieJar(jar_path)
jar.load(ignore_discard=True, ignore_expires=True)
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def call(method, path, body=None, expect=(200, 201)):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        api + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if body is not None else {},
    )
    try:
        with opener.open(req) as resp:
            raw = resp.read().decode()
            code = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        code = e.code
    if code not in expect:
        raise SystemExit(f"FAIL  {method} {path} → {code}: {raw[:400]}")
    return json.loads(raw) if raw else {}

teacher = call("POST", "/teachers", {
    "firstName": "Smoke",
    "lastName": f"T{stamp}",
    "email": f"smoke-ac-t-{stamp}@academia.test",
    "password": "smoke-password-12",
    "level": "C1",
    "availability": "AVAILABLE",
})["teacher"]
student = call("POST", "/students", {
    "firstName": "Smoke",
    "lastName": f"S{stamp}",
    "email": f"smoke-ac-s-{stamp}@academia.test",
    "password": "smoke-password-12",
    "level": "A2",
})["student"]
course = call("POST", "/courses", {
    "name": f"smoke-ac-oto-{stamp}",
    "courseType": "REGULAR",
    "serviceType": "ONE_TO_ONE_60",
    "amountMinor": "12500",
    "currency": "ARS",
})["course"]
group = call("POST", "/groups", {
    "courseId": course["id"],
    "name": f"smoke-ac-g-{stamp}",
})["group"]
call("POST", f"/groups/{group['id']}/teacher", {"teacherId": teacher["id"]})
option = call("POST", "/schedule-options", {
    "day": "MONDAY",
    "startTime": "15:00",
    "endTime": "16:00",
})["scheduleOption"]
call("PATCH", f"/groups/{group['id']}", {"scheduleOptionId": option["id"]})
call("POST", f"/groups/{group['id']}/students", {"studentId": student["id"]})

# Fixed instant — createClassSession still requires schedule on the group.
start = "2026-09-21T18:00:00.000Z"
session = call("POST", "/classes", {
    "groupId": group["id"],
    "startAt": start,
})["classSession"]

charges = call("GET", f"/finance/charges?classSessionId={session['id']}")["charges"]
if len(charges) != 1:
    raise SystemExit(f"FAIL  expected 1 auto Charge, got {len(charges)}")
charge = charges[0]
if charge["amountMinor"] != "12500" or charge["currency"] != "ARS":
    raise SystemExit(f"FAIL  charge snapshot mismatch: {charge}")
if charge["status"] != "OPEN":
    raise SystemExit(f"FAIL  charge should be OPEN before payment: {charge['status']}")

again = call("POST", "/finance/charges", {
    "kind": "CLASS_SESSION",
    "classSessionId": session["id"],
    "studentId": student["id"],
})["charge"]
if again["id"] != charge["id"]:
    raise SystemExit("FAIL  manual createCharge was not idempotent with auto-charge")

print(f"PASS  auto-charge ONE_TO_ONE → OPEN charge ({charge['id'][:8]}…)")

# Persist credentials for Student Hub checkout + Teacher Hub smoke (same process).
# Allocation is filled after student checkout + webhook stub.
open("/tmp/academia-smoke-student.json", "w").write(json.dumps({
    "email": f"smoke-ac-s-{stamp}@academia.test",
    "password": "smoke-password-12",
    "studentId": student["id"],
    "classSessionId": session["id"],
    "courseName": course["name"],
    "chargeId": charge["id"],
}))
open("/tmp/academia-smoke-teacher.json", "w").write(json.dumps({
    "email": f"smoke-ac-t-{stamp}@academia.test",
    "password": "smoke-password-12",
    "teacherId": teacher["id"],
    "studentId": student["id"],
    "studentFirstName": student["firstName"],
    "classSessionId": session["id"],
    "courseName": course["name"],
}))
PY

echo "==> Student Hub (login as STUDENT)"
python3 - "$API_REWRITE" "$BASE_URL" <<'PY'
import json, sys, urllib.request, http.cookiejar

api, base = sys.argv[1], sys.argv[2]
creds = json.load(open("/tmp/academia-smoke-student.json"))
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def call(method, path, body=None, expect=(200, 201), base_url=None):
    root = base_url or api
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        root + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if body is not None else {},
    )
    try:
        with opener.open(req) as resp:
            raw = resp.read().decode()
            code = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        code = e.code
    if code not in expect:
        raise SystemExit(f"FAIL  {method} {path} → {code}: {raw[:400]}")
    return json.loads(raw) if raw else {}

login = call("POST", "/auth/login", {
    "email": creds["email"],
    "password": creds["password"],
})
if login["user"]["role"] != "STUDENT":
    raise SystemExit(f"FAIL  expected STUDENT role, got {login['user']['role']}")

me = call("GET", "/students/me")
if me["student"]["id"] != creds["studentId"]:
    raise SystemExit("FAIL  /students/me returned a different student profile")

# IDOR: arbitrary student id must not be readable without ownership.
call("GET", "/students/00000000-0000-4000-8000-000000000099", expect=(403, 404))

classes = call("GET", "/classes/calendar?from=2026-09-01&to=2026-09-30")
ids = [c["id"] for c in classes["classSessions"]]
if creds["classSessionId"] not in ids:
    raise SystemExit("FAIL  student calendar missing own ClassSession")
own = next(c for c in classes["classSessions"] if c["id"] == creds["classSessionId"])
if own["group"]["course"]["name"] != creds["courseName"]:
    raise SystemExit("FAIL  student calendar course name mismatch")

materials = call("GET", "/students/me/materials")
if "materials" not in materials:
    raise SystemExit("FAIL  materials response missing materials[]")

attendance = call("GET", "/students/me/attendance?from=2026-09-01&to=2026-09-30")
if "attendances" not in attendance:
    raise SystemExit("FAIL  attendance response missing attendances[]")

# Client pages (Turbopack): SSR shell often only embeds the route in chunk refs,
# same pattern as /dashboard/finance. Real content is asserted via API above.
for path, needle in (
    ("/dashboard/student", "dashboard/student"),
    ("/dashboard/student/classes", "dashboard/student/classes"),
    ("/dashboard/student/materials", "dashboard/student/materials"),
    ("/dashboard/student/attendance", "dashboard/student/attendance"),
    ("/dashboard/student/finance", "dashboard/student/finance"),
):
    req = urllib.request.Request(base + path)
    with opener.open(req) as resp:
        html = resp.read().decode()
        code = resp.status
    if code != 200:
        raise SystemExit(f"FAIL  {path} → {code}")
    if "NEXT_REDIRECT;replace;/login" in html:
        raise SystemExit(f"FAIL  {path} redirected to login with a valid student session")
    if needle not in html:
        raise SystemExit(f"FAIL  {path} missing expected route shell ({needle})")
    print(f"PASS  {path}")

# Student Finance portal — OPEN charge from auto-charge, then student checkout.
finance = call("GET", "/students/me/finance")
if "charges" not in finance or "payments" not in finance or "summary" not in finance:
    raise SystemExit("FAIL  /students/me/finance missing charges/payments/summary")
own_charges = [c for c in finance["charges"] if c.get("classSessionId") == creds["classSessionId"]]
if not own_charges:
    raise SystemExit("FAIL  student finance missing charge for own ClassSession")
own = own_charges[0]
if own["id"] != creds["chargeId"]:
    raise SystemExit("FAIL  student finance chargeId mismatch with auto-charge fixture")
if own["amountMinor"] != "12500" or own["currency"] != "ARS":
    raise SystemExit(f"FAIL  student finance charge snapshot mismatch: {own}")
if own["status"] != "OPEN":
    raise SystemExit(f"FAIL  expected OPEN charge before checkout, got {own['status']}")
raw = json.dumps(finance)
if "academyPercentage" in raw or "teacherAmountMinor" in raw or "createdByUserId" in raw:
    raise SystemExit("FAIL  student finance leaked internal finance fields")

# Checkout: OPEN → PENDING Payment (ARS → Mercado Pago stub). Never MANUAL.
pay = call("POST", f"/students/me/finance/charges/{own['id']}/pay", {})
payment = pay["payment"]
if payment["status"] != "PENDING":
    raise SystemExit(f"FAIL  checkout payment not PENDING: {payment['status']}")
if payment["provider"] != "MERCADOPAGO":
    raise SystemExit(f"FAIL  expected MERCADOPAGO for ARS, got {payment['provider']}")
if payment["chargeId"] != own["id"]:
    raise SystemExit("FAIL  checkout payment chargeId mismatch")

# Idempotent double-pay.
pay2 = call("POST", f"/students/me/finance/charges/{own['id']}/pay", {})
if pay2["payment"]["id"] != payment["id"]:
    raise SystemExit("FAIL  checkout double-pay created a second Payment")

pending_finance = call("GET", "/students/me/finance")
pending_own = next(c for c in pending_finance["charges"] if c["id"] == own["id"])
if pending_own["status"] != "OPEN":
    raise SystemExit("FAIL  charge must stay OPEN while Payment is PENDING")
if not any(p["id"] == payment["id"] and p["status"] == "PENDING" for p in pending_finance["payments"]):
    raise SystemExit("FAIL  portal missing PENDING payment after checkout")

# Webhook stub (infra test — not a student UX "mark paid" button).
wh = call("POST", "/finance/webhooks/mercado-pago", {
    "providerEventId": f"smoke-mp-{creds['chargeId']}",
    "type": "payment.succeeded",
    "paymentId": payment["id"],
})
if not wh.get("processed"):
    raise SystemExit(f"FAIL  webhook not processed: {wh}")

paid_finance = call("GET", "/students/me/finance")
paid_own = next(c for c in paid_finance["charges"] if c["id"] == own["id"])
if paid_own["status"] != "PAID":
    raise SystemExit(f"FAIL  expected PAID after webhook, got {paid_own['status']}")
succeeded = [p for p in paid_finance["payments"] if p["status"] == "SUCCEEDED" and p["chargeId"] == own["id"]]
if not succeeded:
    raise SystemExit("FAIL  student finance missing SUCCEEDED payment after webhook")

# IDOR: foreign charge pay + finance detail.
call("POST", "/students/me/finance/charges/00000000-0000-4000-8000-000000000099/pay", {}, expect=(404,))
call("GET", "/finance/charges/00000000-0000-4000-8000-000000000099", expect=(403, 404))
call("GET", "/finance/payments/00000000-0000-4000-8000-000000000099", expect=(403, 404))

# Hand allocation ids to Teacher Hub smoke (login as director via separate jar later).
# Teacher smoke loads teacher.json; patch allocation after admin re-login below is awkward.
# Persist paymentId so teacher block can look up allocations as director… Teacher uses
# scoped earnings. Update teacher fixture with paymentId for allocation lookup.
teacher_creds = json.load(open("/tmp/academia-smoke-teacher.json"))
teacher_creds["paymentId"] = payment["id"]
open("/tmp/academia-smoke-teacher.json", "w").write(json.dumps(teacher_creds))

print(f"PASS  Student Hub + checkout (me={me['student']['id'][:8]}…, classes={len(ids)}, materials={len(materials['materials'])}, attendance={len(attendance['attendances'])}, payment={payment['id'][:8]}…)")
PY

echo "==> Teacher Hub (login as TEACHER)"
python3 - "$API_REWRITE" "$BASE_URL" <<'PY'
import json, sys, urllib.request, http.cookiejar

api, base = sys.argv[1], sys.argv[2]
creds = json.load(open("/tmp/academia-smoke-teacher.json"))
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def call(method, path, body=None, expect=(200, 201), base_url=None):
    root = base_url or api
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        root + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if body is not None else {},
    )
    try:
        with opener.open(req) as resp:
            raw = resp.read().decode()
            code = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        code = e.code
    if code not in expect:
        raise SystemExit(f"FAIL  {method} {path} → {code}: {raw[:400]}")
    return json.loads(raw) if raw else {}

login = call("POST", "/auth/login", {
    "email": creds["email"],
    "password": creds["password"],
})
if login["user"]["role"] != "TEACHER":
    raise SystemExit(f"FAIL  expected TEACHER role, got {login['user']['role']}")

me = call("GET", "/teachers/me")
if me["teacher"]["id"] != creds["teacherId"]:
    raise SystemExit("FAIL  /teachers/me returned a different teacher profile")

# IDOR: arbitrary teacher id / foreign teacher settlement.
call("GET", "/teachers/00000000-0000-4000-8000-000000000099", expect=(403, 404))
call("GET", "/students/00000000-0000-4000-8000-000000000099", expect=(403, 404))

classes = call("GET", "/classes/calendar?from=2026-09-01&to=2026-09-30")
ids = [c["id"] for c in classes["classSessions"]]
if creds["classSessionId"] not in ids:
    raise SystemExit("FAIL  teacher calendar missing own ClassSession")
own = next(c for c in classes["classSessions"] if c["id"] == creds["classSessionId"])
if own["group"]["course"]["name"] != creds["courseName"]:
    raise SystemExit("FAIL  teacher calendar course name mismatch")

students = call("GET", "/teachers/me/students")
stu_ids = [s["id"] for s in students["students"]]
if creds["studentId"] not in stu_ids:
    raise SystemExit("FAIL  teacher students list missing enrolled student")
mine = next(s for s in students["students"] if s["id"] == creds["studentId"])
if mine["firstName"] != creds["studentFirstName"]:
    raise SystemExit("FAIL  teacher student firstName mismatch")

materials = call("GET", "/teachers/me/materials")
if "materials" not in materials:
    raise SystemExit("FAIL  materials response missing materials[]")

attendance = call("GET", "/teachers/me/attendance?from=2026-09-01&to=2026-09-30")
if "attendances" not in attendance:
    raise SystemExit("FAIL  attendance response missing attendances[]")

# Mark attendance on own class (write path); 409 → patch.
def call_raw(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        api + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if body is not None else {},
    )
    try:
        with opener.open(req) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

code, mark = call_raw("POST", f"/classes/{creds['classSessionId']}/attendance", {
    "studentId": creds["studentId"],
    "status": "PRESENT",
})
if code == 409:
    code, mark = call_raw(
        "PATCH",
        f"/classes/{creds['classSessionId']}/attendance/{creds['studentId']}",
        {"status": "PRESENT"},
    )
if code not in (200, 201) or "attendance" not in mark:
    raise SystemExit(f"FAIL  attendance write → {code}: {mark}")

attendance2 = call("GET", "/teachers/me/attendance?from=2026-09-01&to=2026-09-30")
if not any(a["classSessionId"] == creds["classSessionId"] for a in attendance2["attendances"]):
    raise SystemExit("FAIL  teacher attendance history missing own class after mark")

# Notes on own class.
note = call("POST", f"/classes/{creds['classSessionId']}/notes", {
    "content": f"Smoke note {creds['classSessionId'][:8]}",
})
if "note" not in note:
    raise SystemExit(f"FAIL  note create unexpected body: {note}")

# Earnings: allocations from student checkout → webhook (session teacher only).
allocs = call("GET", "/finance/allocations")["allocations"]
if any(a["teacherId"] != creds["teacherId"] for a in allocs):
    raise SystemExit("FAIL  teacher saw allocation for another teacher")
own_allocs = [a for a in allocs if a.get("paymentId") == creds.get("paymentId")]
if not own_allocs:
    raise SystemExit("FAIL  teacher allocations missing allocation for student checkout payment")
if own_allocs[0]["teacherId"] != creds["teacherId"]:
    raise SystemExit("FAIL  allocation teacher mismatch after student checkout")

settlements = call("GET", "/finance/settlements")["settlements"]
if any(s["teacherId"] != creds["teacherId"] for s in settlements):
    raise SystemExit("FAIL  teacher saw settlement for another teacher")

# Foreign class IDOR (random session)
call("GET", "/classes/00000000-0000-4000-8000-000000000099/attendance", expect=(403, 404))

for path, needle in (
    ("/dashboard/teacher", "dashboard/teacher"),
    ("/dashboard/teacher/classes", "dashboard/teacher/classes"),
    ("/dashboard/teacher/students", "dashboard/teacher/students"),
    ("/dashboard/teacher/materials", "dashboard/teacher/materials"),
    ("/dashboard/teacher/attendance", "dashboard/teacher/attendance"),
    ("/dashboard/teacher/earnings", "dashboard/teacher/earnings"),
):
    req = urllib.request.Request(base + path)
    with opener.open(req) as resp:
        html = resp.read().decode()
        code = resp.status
    if code != 200:
        raise SystemExit(f"FAIL  {path} → {code}")
    if "NEXT_REDIRECT;replace;/login" in html:
        raise SystemExit(f"FAIL  {path} redirected to login with a valid teacher session")
    if needle not in html:
        raise SystemExit(f"FAIL  {path} missing expected route shell ({needle})")
    print(f"PASS  {path}")

print(
    f"PASS  Teacher Hub API (me={me['teacher']['id'][:8]}…, classes={len(ids)}, "
    f"students={len(stu_ids)}, materials={len(materials['materials'])}, "
    f"attendance={len(attendance2['attendances'])}, allocations={len(allocs)})"
)
PY

echo "==> Logout"
logout_code="$(
  curl -s -o /dev/null -w '%{http_code}' \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -X POST "${API_REWRITE}/auth/logout"
)"
if [[ "$logout_code" != "204" && "$logout_code" != "200" ]]; then
  echo "FAIL  logout returned ${logout_code}" >&2
  exit 1
fi
echo "PASS  logout (${logout_code})"

me_after="$(
  curl -s -o /dev/null -w '%{http_code}' \
    -b "$COOKIE_JAR" \
    "${API_REWRITE}/auth/me"
)"
if [[ "$me_after" != "401" ]]; then
  echo "FAIL  /auth/me after logout returned ${me_after} (expected 401)" >&2
  exit 1
fi
echo "PASS  /auth/me after logout → 401"

echo
echo "Smoke OK against ${BASE_URL}"
