# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  QQGPT — Smart College Complaint Management System                      ║
# ║  main.py  ·  Startup Health Check & Launch Utility                     ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# Usage:
#   python main.py            — full health check + launch Flask in dev mode
#   python main.py --check    — health check only (exits 0 = OK, 1 = fail)
#   python main.py --serve    — skip check, launch Flask directly
#
# In production use gunicorn instead:
#   gunicorn -w 2 -b 0.0.0.0:5001 app:app
# ──────────────────────────────────────────────────────────────────────────────

import os
import sys
import argparse
import importlib.util
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# ── Parse CLI arguments ───────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description='QQGPT Smart CMS — health check / launch')
group = parser.add_mutually_exclusive_group()
group.add_argument('--check',  action='store_true', help='health check only')
group.add_argument('--serve',  action='store_true', help='skip check, launch Flask')
args = parser.parse_args()


def _banner(text: str, width: int = 52) -> str:
    pad = max(0, width - 4 - len(text))
    return f'│  {text}{" " * pad}│'


def health_check() -> bool:
    """Run all pre-flight checks. Returns True if everything is OK."""
    checks = {}
    print('╔' + '═' * 50 + '╗')
    print('║   QQGPT Smart CMS — Health Check' + ' ' * 17 + '║')
    print('╠' + '═' * 50 + '╣')

    # ── 1. Environment variables ─────────────────────────────────────────────
    required_env = {
        'DATABASE_URL':   bool(os.getenv('DATABASE_URL', '').strip()),
        'SECRET_KEY':     bool(os.getenv('SECRET_KEY', '').strip()),
        'ADMIN_EMAIL':    bool(os.getenv('ADMIN_EMAIL', '').strip()),
        'GEMINI_API_KEY': bool(os.getenv('GEMINI_API_KEY', '').strip()),
    }
    optional_env = {
        'GEMINI_MODEL': bool(os.getenv('GEMINI_MODEL', '').strip()),
        'FLASK_ENV':    bool(os.getenv('FLASK_ENV', '').strip()),
    }
    for key, present in required_env.items():
        status = '✓' if present else '✗  MISSING'
        print(_banner(f'  {("SET" if present else "NOT SET"):7}  {key}'))
        checks[key] = present

    print('├' + '─' * 50 + '┤')
    for key, present in optional_env.items():
        label = 'SET' if present else 'not set'
        print(_banner(f'  opt  {label}  [{key}]'))

    # ── 2. Database connectivity ──────────────────────────────────────────────
    print('├' + '─' * 50 + '┤')
    db_ok = False
    db_url = ''
    for key in ('DATABASE_URL', 'POSTGRES_URL', 'POSTGRESQL_URL', 'RENDER_DATABASE_URL', 'RENDER_POSTGRESQL_URL'):
        value = (os.getenv(key) or '').strip()
        if value:
            db_url = value
            break
    if db_url:
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        if 'sslmode=' not in db_url:
            db_url += ('&' if '?' in db_url else '?') + 'sslmode=require'
        try:
            try:
                import psycopg2
            except Exception:
                import psycopg as psycopg2
            from urllib.parse import urlparse
            host = urlparse(db_url).hostname or 'unknown'
            conn = psycopg2.connect(db_url, connect_timeout=8)
            cur  = conn.cursor()
            cur.execute('SELECT version()')
            version_row = cur.fetchone() or ('unknown',)
            ver = str(version_row[0]).split(',')[0]
            cur.close()
            conn.close()
            print(_banner(f'  ✓  DB connected  ({host})'))
            print(_banner(f'     {ver[:44]}'))
            db_ok = True
            checks['DATABASE'] = True
        except Exception as exc:
            print(_banner(f'  ✗  DB connection failed: {str(exc)[:30]}'))
            checks['DATABASE'] = False
    else:
        print(_banner('  ✗  DATABASE_URL missing — cannot test DB'))
        checks['DATABASE'] = False

    # ── 3. Gemini API key validity (lightweight) ──────────────────────────────
    print('├' + '─' * 50 + '┤')
    api_key = os.getenv('GEMINI_API_KEY', '').strip()
    if not api_key:
        print(_banner('  ⚠  GEMINI_API_KEY not set — chatbot disabled'))
        checks['GEMINI'] = False  # warning, not fatal
    elif len(api_key) < 20:
        print(_banner('  ✗  GEMINI_API_KEY looks too short'))
        checks['GEMINI'] = False
    else:
        print(_banner(f'  ✓  GEMINI_API_KEY present  ({api_key[:8]}...)'))
        model = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
        print(_banner(f'     Model: {model}'))
        checks['GEMINI'] = True

    # ── 4. Secret key strength ────────────────────────────────────────────────
    print('├' + '─' * 50 + '┤')
    sk = os.getenv('SECRET_KEY', '')
    if len(sk) < 16:
        print(_banner('  ✗  SECRET_KEY is too short (min 16 chars)'))
        checks['SECRET_KEY'] = False
    elif sk in ('smart_cms_secret_2024', 'your-secret-key', 'changeme'):
        print(_banner('  ⚠  SECRET_KEY is a default value — change it!'))
        checks['SECRET_KEY'] = True   # warn but not fatal for dev
    else:
        print(_banner(f'  ✓  SECRET_KEY set  ({len(sk)} chars)'))
        checks['SECRET_KEY'] = True

    # ── 5. Summary ────────────────────────────────────────────────────────────
    print('╠' + '═' * 50 + '╣')
    fatal_failures = [k for k, v in checks.items()
                      if not v and k not in ('GEMINI',)]
    if not fatal_failures:
        print('║   RESULT:  ✓  All required checks passed           ║')
        print('╚' + '═' * 50 + '╝')
        return True
    else:
        print(f'║   RESULT:  ✗  {len(fatal_failures)} check(s) failed: {", ".join(fatal_failures)[:28]}')
        print('║   Run  python "db_setup 2.py" to initialise DB   ║')
        print('╚' + '═' * 50 + '╝')
        return False


def launch_flask():
    """Launch Flask in development mode."""
    print()
    print('[INFO] Starting Flask development server...')
    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    port  = int(os.getenv('PORT', '5001'))
    host  = '0.0.0.0'
    print(f'[INFO] Listening on http://{host}:{port}  (debug={debug})')
    print('[INFO] Press Ctrl+C to stop.')
    print()

    # Import here so import errors are caught after health check output.
    # Supports app.py as the active entry, while keeping app 2.py as a fallback.
    app_candidates = [Path('app.py'), Path('app 2.py')]
    app_file = next((p for p in app_candidates if p.exists()), None)
    if not app_file:
        raise RuntimeError('No Flask app entry found. Expected app.py or app 2.py in project root.')

    module_name = app_file.stem.replace(' ', '_')
    spec = importlib.util.spec_from_file_location(module_name, app_file)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load Flask app from {app_file}.')

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    flask_app = getattr(module, 'app', None)
    if flask_app is None:
        raise RuntimeError(f"{app_file} does not expose a Flask variable named 'app'.")

    flask_app.run(host=host, port=port, debug=debug)


# ── Main ──────────────────────────────────────────────────────────────────────
if args.serve:
    launch_flask()
elif args.check:
    ok = health_check()
    sys.exit(0 if ok else 1)
else:
    # Default: check then launch
    ok = health_check()
    if not ok:
        print('[ERROR] One or more required checks failed. Fix them before launching.')
        sys.exit(1)
    launch_flask()
