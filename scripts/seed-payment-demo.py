#!/usr/bin/env python3
"""
Idempotent local demo data for Mercado Pago (ARS) and Stripe (USD).

Prerequisites: academia-dev stack up; SUPERADMIN or DIRECTOR credentials in .env.
Does not touch production, create remote PSP resources, or print secrets from .env.

Usage (repo root):
  python3 scripts/seed-payment-demo.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from http.cookiejar import CookieJar
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ENV_PATH = REPO / ".env"

DEMO_PASSWORD = "demo-password-12"
TEACHER_PASSWORD = "demo-teacher-12"

STUDENT_ARS = {
    "email": "demo.mp.ars@academia.test",
    "firstName": "Ana",
    "lastName": "Mercado",
    "level": "A2",
}
STUDENT_USD = {
    "email": "demo.stripe.usd@academia.test",
    "firstName": "Sam",
    "lastName": "Stripe",
    "level": "B1",
}
TEACHER = {
    "email": "demo.teacher@academia.test",
    "firstName": "Tito",
    "lastName": "Demo",
    "level": "C1",
}

COURSE_ARS_NAME = "Demo 1:1 ARS (Mercado Pago)"
COURSE_USD_NAME = "Demo 1:1 USD (Stripe)"
# Minor units: ARS 100.00 (small if live APP_USR); USD 5.00 (Stripe test)
ARS_AMOUNT_MINOR = "10000"
USD_AMOUNT_MINOR = "500"


def env_get(key: str) -> str:
    if not ENV_PATH.is_file():
        raise SystemExit("Missing .env — copy from .env.example first.")
    value = ""
    for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if raw.startswith(f"{key}="):
            value = raw.split("=", 1)[1]
    return value


class Api:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar),
        )

    def request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
    ) -> tuple[int, dict | list | None]:
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(
            f"{self.base}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with self.opener.open(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                parsed = json.loads(raw) if raw else None
                return resp.status, parsed
        except urllib.error.HTTPError as err:
            raw = err.read().decode("utf-8")
            try:
                parsed = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                parsed = {"raw": raw[:300]}
            return err.code, parsed


def find_by_email(items: list[dict], email: str, nest: str) -> dict | None:
    target = email.lower()
    for item in items:
        node = item.get(nest, item)
        # students/teachers list may nest user.email or top-level email
        candidates = [
            node.get("email"),
            (node.get("user") or {}).get("email"),
            item.get("email"),
            (item.get("user") or {}).get("email"),
        ]
        for c in candidates:
            if isinstance(c, str) and c.lower() == target:
                return item if nest == "" else node
        # profile id wrappers: { student: {...} } or flat
        if nest and nest in item:
            inner = item[nest]
            for c in [
                inner.get("email"),
                (inner.get("user") or {}).get("email"),
            ]:
                if isinstance(c, str) and c.lower() == target:
                    return inner
    return None


def ensure_student(api: Api, spec: dict) -> str:
    status, payload = api.request("GET", "/students")
    if status != 200:
        raise SystemExit(f"GET /students failed: {status} {payload}")
    students = payload.get("students", []) if isinstance(payload, dict) else []
    for s in students:
        email = (s.get("email") or (s.get("user") or {}).get("email") or "").lower()
        if email == spec["email"].lower():
            print(f"  student exists: {spec['email']}")
            return s["id"]
    status, payload = api.request(
        "POST",
        "/students",
        {
            "email": spec["email"],
            "password": DEMO_PASSWORD,
            "firstName": spec["firstName"],
            "lastName": spec["lastName"],
            "level": spec["level"],
        },
    )
    if status not in (200, 201):
        raise SystemExit(f"POST /students {spec['email']}: {status} {payload}")
    print(f"  student created: {spec['email']}")
    return payload["student"]["id"]


def ensure_teacher(api: Api) -> str:
    status, payload = api.request("GET", "/teachers")
    if status != 200:
        raise SystemExit(f"GET /teachers failed: {status} {payload}")
    teachers = payload.get("teachers", []) if isinstance(payload, dict) else []
    for t in teachers:
        email = (t.get("email") or (t.get("user") or {}).get("email") or "").lower()
        if email == TEACHER["email"].lower():
            print(f"  teacher exists: {TEACHER['email']}")
            return t["id"]
    status, payload = api.request(
        "POST",
        "/teachers",
        {
            "email": TEACHER["email"],
            "password": TEACHER_PASSWORD,
            "firstName": TEACHER["firstName"],
            "lastName": TEACHER["lastName"],
            "level": TEACHER["level"],
        },
    )
    if status not in (200, 201):
        raise SystemExit(f"POST /teachers: {status} {payload}")
    print(f"  teacher created: {TEACHER['email']}")
    return payload["teacher"]["id"]


def ensure_course(
    api: Api,
    *,
    name: str,
    currency: str,
    amount_minor: str,
) -> str:
    status, payload = api.request("GET", "/courses")
    if status != 200:
        raise SystemExit(f"GET /courses failed: {status} {payload}")
    courses = payload.get("courses", []) if isinstance(payload, dict) else []
    for c in courses:
        if c.get("name") == name and c.get("isActive", True):
            # Patch price if missing/wrong so charges can be created
            needs = c.get("amountMinor") != amount_minor or c.get("currency") != currency
            if needs:
                st, body = api.request(
                    "PATCH",
                    f"/courses/{c['id']}",
                    {"amountMinor": amount_minor, "currency": currency},
                )
                if st != 200:
                    raise SystemExit(f"PATCH /courses/{c['id']}: {st} {body}")
                print(f"  course price updated: {name} ({amount_minor} {currency})")
            else:
                print(f"  course exists: {name}")
            return c["id"]
    status, payload = api.request(
        "POST",
        "/courses",
        {
            "name": name,
            "courseType": "REGULAR",
            "serviceType": "ONE_TO_ONE_60",
            "amountMinor": amount_minor,
            "currency": currency,
            "description": f"Demo payment course ({currency})",
        },
    )
    if status not in (200, 201):
        raise SystemExit(f"POST /courses {name}: {status} {payload}")
    print(f"  course created: {name}")
    return payload["course"]["id"]


def ensure_group(api: Api, *, course_id: str, name: str, teacher_id: str) -> str:
    status, payload = api.request("GET", "/groups")
    if status != 200:
        raise SystemExit(f"GET /groups failed: {status} {payload}")
    groups = payload.get("groups", []) if isinstance(payload, dict) else []
    group_id = None
    for g in groups:
        if g.get("name") == name and g.get("courseId") == course_id and g.get("isActive", True):
            group_id = g["id"]
            print(f"  group exists: {name}")
            break
    if not group_id:
        status, payload = api.request(
            "POST",
            "/groups",
            {"courseId": course_id, "name": name},
        )
        if status not in (200, 201):
            raise SystemExit(f"POST /groups {name}: {status} {payload}")
        group_id = payload["group"]["id"]
        print(f"  group created: {name}")

    # Assign teacher (idempotent enough — 200/201/409 ok)
    st, body = api.request(
        "POST",
        f"/groups/{group_id}/teacher",
        {"teacherId": teacher_id},
    )
    if st not in (200, 201, 204) and st != 409:
        # Some APIs return 200 with body; 400 if already same teacher
        msg = str(body)
        if "already" not in msg.lower() and st not in (200, 201):
            # try continue if already assigned
            if st == 400 and "teacher" in msg.lower():
                pass
            else:
                print(f"  warn assign teacher: {st} {body}")

    # Schedule option
    st, sched = api.request(
        "POST",
        "/schedule-options",
        {"day": "WEDNESDAY", "startTime": "10:00", "endTime": "11:00"},
    )
    if st in (200, 201):
        opt_id = sched["scheduleOption"]["id"]
        api.request("PATCH", f"/groups/{group_id}", {"scheduleOptionId": opt_id})
    return group_id


def ensure_enrollment(api: Api, group_id: str, student_id: str) -> None:
    st, body = api.request(
        "POST",
        f"/groups/{group_id}/students",
        {"studentId": student_id},
    )
    if st in (200, 201):
        print(f"  enrolled student in group {group_id[:8]}…")
        return
    if st == 409:
        print("  enrollment already active")
        return
    # duplicate message variants
    msg = json.dumps(body) if body else ""
    if "already" in msg.lower() or "enrolled" in msg.lower():
        print("  enrollment already active")
        return
    raise SystemExit(f"POST enroll: {st} {body}")


def create_demo_class(api: Api, group_id: str, label: str) -> str:
    start = datetime.now(timezone.utc) + timedelta(days=3)
    # Align to a round hour
    start = start.replace(minute=0, second=0, microsecond=0)
    start_at = start.isoformat().replace("+00:00", "Z")
    st, body = api.request(
        "POST",
        "/classes",
        {
            "groupId": group_id,
            "startAt": start_at,
            "meetingDescription": f"Demo clase {label}",
        },
    )
    if st == 409:
        # Overlap — find existing open class for group via list
        print(f"  class slot overlap for {label}; looking up existing classes…")
        lst_st, lst = api.request("GET", "/classes")
        if lst_st != 200:
            raise SystemExit(f"GET /classes: {lst_st} {lst}")
        sessions = lst.get("classSessions", []) if isinstance(lst, dict) else []
        for s in sessions:
            if s.get("groupId") == group_id and s.get("isActive"):
                return s["id"]
        # try another slot
        start = start + timedelta(hours=2)
        start_at = start.isoformat().replace("+00:00", "Z")
        st, body = api.request(
            "POST",
            "/classes",
            {"groupId": group_id, "startAt": start_at},
        )
    if st not in (200, 201):
        raise SystemExit(f"POST /classes ({label}): {st} {body}")
    class_id = body["classSession"]["id"]
    print(f"  class created ({label}): {class_id}")
    return class_id


def ensure_charge(api: Api, class_id: str, student_id: str, label: str) -> dict:
    # List charges for student; reuse OPEN for this class if present
    st, body = api.request("GET", f"/finance/charges?studentId={student_id}")
    if st == 200 and isinstance(body, dict):
        for c in body.get("charges", []):
            if c.get("classSessionId") == class_id and c.get("status") == "OPEN":
                print(f"  OPEN charge exists ({label}): {c['id']}")
                return c
    st, body = api.request(
        "POST",
        "/finance/charges",
        {
            "kind": "CLASS_SESSION",
            "classSessionId": class_id,
            "studentId": student_id,
            "description": f"Demo cargo {label}",
        },
    )
    if st in (200, 201):
        charge = body["charge"]
        print(
            f"  charge created ({label}): {charge['id']} "
            f"{charge['amountMinor']} {charge['currency']} {charge['status']}",
        )
        return charge
    # Auto-charge may have already created it
    if st == 409:
        st2, body2 = api.request("GET", f"/finance/charges?studentId={student_id}")
        if st2 == 200:
            for c in body2.get("charges", []):
                if c.get("classSessionId") == class_id:
                    print(f"  charge already present ({label}): {c['id']}")
                    return c
    raise SystemExit(f"POST /finance/charges ({label}): {st} {body}")


def main() -> None:
    api_port = env_get("API_PORT") or "4000"
    base = f"http://127.0.0.1:{api_port}"

    # Prefer director; fall back to superadmin
    email = env_get("DIRECTOR_EMAIL")
    password = env_get("DIRECTOR_PASSWORD")
    role_hint = "DIRECTOR"
    if not email or not password:
        email = env_get("SUPERADMIN_EMAIL")
        password = env_get("SUPERADMIN_PASSWORD")
        role_hint = "SUPER_ADMIN"
    if not email or not password:
        raise SystemExit("Need DIRECTOR_* or SUPERADMIN_* credentials in .env")

    api = Api(base)
    print(f"==> API {base}")
    health_st, _ = api.request("GET", "/health")
    if health_st != 200:
        raise SystemExit(f"API /health returned {health_st}. Is the stack up?")

    print(f"==> Login as {role_hint} ({email})")
    st, body = api.request(
        "POST",
        "/auth/login",
        {"email": email, "password": password},
    )
    if st != 200:
        raise SystemExit(f"Login failed: {st} {body}")

    print("==> Teacher")
    teacher_id = ensure_teacher(api)

    print("==> Courses")
    course_ars = ensure_course(
        api,
        name=COURSE_ARS_NAME,
        currency="ARS",
        amount_minor=ARS_AMOUNT_MINOR,
    )
    course_usd = ensure_course(
        api,
        name=COURSE_USD_NAME,
        currency="USD",
        amount_minor=USD_AMOUNT_MINOR,
    )

    print("==> Groups")
    group_ars = ensure_group(
        api,
        course_id=course_ars,
        name="Demo Grupo MP ARS",
        teacher_id=teacher_id,
    )
    group_usd = ensure_group(
        api,
        course_id=course_usd,
        name="Demo Grupo Stripe USD",
        teacher_id=teacher_id,
    )

    print("==> Students")
    student_ars = ensure_student(api, STUDENT_ARS)
    student_usd = ensure_student(api, STUDENT_USD)

    print("==> Enrollments")
    ensure_enrollment(api, group_ars, student_ars)
    ensure_enrollment(api, group_usd, student_usd)

    print("==> Classes + charges")
    class_ars = create_demo_class(api, group_ars, "ARS/MP")
    class_usd = create_demo_class(api, group_usd, "USD/Stripe")
    charge_ars = ensure_charge(api, class_ars, student_ars, "ARS/MP")
    charge_usd = ensure_charge(api, class_usd, student_usd, "USD/Stripe")

    web_port = env_get("WEB_PORT") or "3000"
    print()
    print("=" * 60)
    print("DEMO LISTA — pagos")
    print("=" * 60)
    print(f"Web: http://localhost:{web_port}")
    print()
    print("Mercado Pago (ARS)")
    print(f"  Login:  {STUDENT_ARS['email']}")
    print(f"  Pass:   {DEMO_PASSWORD}")
    print(f"  Cargo:  {charge_ars.get('amountMinor')} {charge_ars.get('currency')} "
          f"({charge_ars.get('status')})")
    print("  Ir a:   /dashboard/student/finance → Pagar")
    print()
    print("Stripe (USD)")
    print(f"  Login:  {STUDENT_USD['email']}")
    print(f"  Pass:   {DEMO_PASSWORD}")
    print(f"  Cargo:  {charge_usd.get('amountMinor')} {charge_usd.get('currency')} "
          f"({charge_usd.get('status')})")
    print("  Ir a:   /dashboard/student/finance → Pagar")
    print("  Tarjeta test: 4242 4242 4242 4242 · fecha futura · CVC cualquiera")
    print()
    print("Docente demo (opcional)")
    print(f"  Login:  {TEACHER['email']}")
    print(f"  Pass:   {TEACHER_PASSWORD}")
    print()
    print("Antes de pagar:")
    print("  • Stripe: `stripe listen --forward-to http://127.0.0.1:4000/finance/webhooks/stripe`")
    print("  • MP: ngrok http 4000 + API_PUBLIC_URL actualizado + webhook en panel MP")
    print("  • Token MP APP_USR = dinero real; monto ARS demo es bajo a propósito.")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
