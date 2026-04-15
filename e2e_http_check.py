import re
import sys
import uuid
from urllib.parse import urljoin

import requests

BASE = "http://127.0.0.1:5001"
s = requests.Session()
s.headers.update({"User-Agent": "E2E-Check/1.0"})
results = []

def ok(name, passed, detail=""):
    results.append((name, passed, detail))

def get_csrf(html):
    m = re.search(r'name="csrf_token"\s+value="([^"]+)"', html)
    return m.group(1) if m else None

r = s.get(urljoin(BASE, "/admin-login"), timeout=15)
ok("admin-login page", r.status_code == 200 and "not for students" in r.text.lower(), f"status={r.status_code}")

email = f"e2e_{uuid.uuid4().hex[:8]}@test.local"
password1 = "Pass12345"
password2 = "Pass67890"

r = s.get(urljoin(BASE, "/register"), timeout=15)
csrf = get_csrf(r.text)
if not csrf:
    ok("register csrf", False, "missing csrf token")
else:
    r2 = s.post(
        urljoin(BASE, "/register"),
        data={
            "csrf_token": csrf,
            "name": "E2E Student",
            "email": email,
            "password": password1,
            "confirm_password": password1,
        },
        allow_redirects=True,
        timeout=15,
    )
    txt = r2.text.lower()
    reg_ok = ("registration successful" in txt) or ("login" in txt)
    ok("register flow", reg_ok, f"final_url={r2.url}")

r = s.get(urljoin(BASE, "/login"), timeout=15)
csrf = get_csrf(r.text)
if not csrf:
    ok("login csrf", False, "missing csrf token")
else:
    r3 = s.post(
        urljoin(BASE, "/login"),
        data={"csrf_token": csrf, "email": email, "password": "Wrong12345"},
        allow_redirects=True,
        timeout=15,
    )
    ok("wrong-password handling", "incorrect password" in r3.text.lower(), f"url={r3.url}")

r = s.get(urljoin(BASE, "/login"), timeout=15)
csrf = get_csrf(r.text)
if not csrf:
    ok("login csrf 2", False, "missing csrf token")
else:
    unknown_email = f"nouser_{uuid.uuid4().hex[:6]}@test.local"
    r4 = s.post(
        urljoin(BASE, "/login"),
        data={"csrf_token": csrf, "email": unknown_email, "password": "Anypass123"},
        allow_redirects=True,
        timeout=15,
    )
    ok("account-not-found redirect", "/register" in r4.url and "account not found" in r4.text.lower(), f"url={r4.url}")

r = s.get(urljoin(BASE, "/forgot-password"), timeout=15)
csrf = get_csrf(r.text)
if not csrf:
    ok("forgot stage1 csrf", False, "missing csrf token")
else:
    r5 = s.post(
        urljoin(BASE, "/forgot-password"),
        data={"csrf_token": csrf, "email": email},
        allow_redirects=True,
        timeout=15,
    )
    ok("forgot stage1->confirm", "i understand, continue" in r5.text.lower(), f"url={r5.url}")

    csrf2 = get_csrf(r5.text)
    if not csrf2:
        ok("forgot confirm csrf", False, "missing csrf token")
    else:
        r6 = s.post(
            urljoin(BASE, "/forgot-password"),
            data={"csrf_token": csrf2, "action": "confirm"},
            allow_redirects=True,
            timeout=15,
        )
        ok("forgot confirm->form", "update password" in r6.text.lower() and "new password" in r6.text.lower(), f"url={r6.url}")

        csrf3 = get_csrf(r6.text)
        if not csrf3:
            ok("forgot reset csrf", False, "missing csrf token")
        else:
            r7 = s.post(
                urljoin(BASE, "/forgot-password"),
                data={
                    "csrf_token": csrf3,
                    "action": "reset",
                    "password": password2,
                    "confirm_password": password2,
                },
                allow_redirects=True,
                timeout=15,
            )
            reset_ok = ("password has been reset" in r7.text.lower()) or ("student login" in r7.text.lower())
            ok("forgot reset submit", reset_ok, f"url={r7.url}")

r = s.get(urljoin(BASE, "/login"), timeout=15)
csrf = get_csrf(r.text)
if not csrf:
    ok("login csrf after reset", False, "missing csrf token")
else:
    r8 = s.post(
        urljoin(BASE, "/login"),
        data={"csrf_token": csrf, "email": email, "password": password2},
        allow_redirects=True,
        timeout=15,
    )
    dash_ok = ("dashboard" in r8.url.lower()) or ("welcome" in r8.text.lower() and "complaint" in r8.text.lower())
    ok("login with reset password", dash_ok, f"url={r8.url}")

r = s.get(urljoin(BASE, "/submit"), timeout=15)
csrf = get_csrf(r.text)
if not csrf:
    ok("submit csrf", False, "missing csrf token")
else:
    r9 = s.post(
        urljoin(BASE, "/submit"),
        data={
            "csrf_token": csrf,
            "category": "Classroom",
            "priority": "Medium",
            "description": "Classroom fan in LH-3 is not working properly since morning and needs repair.",
        },
        allow_redirects=True,
        timeout=15,
    )
    submit_ok = ("complaint submitted successfully" in r9.text.lower()) or ("classroom" in r9.text.lower() and "pending" in r9.text.lower())
    ok("submit complaint", submit_ok, f"url={r9.url}")

r10 = s.get(urljoin(BASE, "/admin/dashboard"), allow_redirects=True, timeout=15)
blocked = ("admin access required" in r10.text.lower()) or ("admin login" in r10.text.lower())
ok("student blocked admin dashboard", blocked, f"url={r10.url}")

passed = sum(1 for _, p, _ in results if p)
print("E2E_RESULTS_START")
for name, p, detail in results:
    print(f"{'PASS' if p else 'FAIL'} | {name} | {detail}")
print(f"SUMMARY | {passed}/{len(results)} passed")
print("E2E_RESULTS_END")
sys.exit(0 if passed == len(results) else 1)
