#!/usr/bin/env python3
import os
from dotenv import load_dotenv
from types import SimpleNamespace

load_dotenv()

try:
    import psycopg2
    import psycopg2.extras
except:
    import psycopg as _psycopg
    from psycopg.rows import dict_row as _dict_row
    
    class _RealDictCursor:
        pass
    
    class _ConnectionProxy:
        def __init__(self, conn):
            self._conn = conn
        def cursor(self, *args, **kwargs):
            cursor_factory = kwargs.pop('cursor_factory', None)
            if cursor_factory is _RealDictCursor:
                kwargs['row_factory'] = _dict_row
            return self._conn.cursor(*args, **kwargs)
        def __getattr__(self, name):
            return getattr(self._conn, name)
    
    psycopg2 = SimpleNamespace(
        connect=lambda *args, **kwargs: _ConnectionProxy(_psycopg.connect(*args, **kwargs)),
        OperationalError=_psycopg.OperationalError,
        IntegrityError=_psycopg.IntegrityError,
        Error=_psycopg.Error,
        extras=SimpleNamespace(RealDictCursor=_RealDictCursor),
    )

try:
    db = psycopg2.connect(os.getenv('DATABASE_URL'), connect_timeout=10)
    cur = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute('SELECT id, title, created_at FROM notices ORDER BY created_at DESC LIMIT 15')
    notices = cur.fetchall()
    print(f'\n✓ Total notices in DB: {len(notices)}')
    print('-' * 60)
    for i, n in enumerate(notices, 1):
        print(f'{i}. ID={n["id"]}, Title="{n["title"]}", Created={n["created_at"]}')
    cur.close()
    db.close()
    print('-' * 60)
except Exception as e:
    print(f'✗ Error: {e}')
