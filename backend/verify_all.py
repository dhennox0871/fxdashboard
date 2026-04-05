import sqlite3
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
databases = ["oslsrg", "oslank", "oslken", "sksmrt"]

print("=" * 60)
print("  DATABASE VERIFICATION REPORT")
print("=" * 60)

db_dir = os.environ.get('DB_DIR', os.path.abspath(os.path.join(SCRIPT_DIR, '..', 'data')))

for db_name in databases:
    db_path = os.path.join(db_dir, f'{db_name}.db')
    if not os.path.exists(db_path):
        print(f"\n  {db_path}: NOT FOUND")
        continue

    size = os.path.getsize(db_path)
    print(f"\n--- {db_name}.db ({size / (1024*1024):.2f} MB) ---")

    db = sqlite3.connect(db_path)
    c = db.cursor()

    tables = ['logtrans', 'logtransline', 'masteritem', 'masteritemgroup',
              'mastercostcenter', 'masterrepresentative', 'flexnotesetting', 'coreapplication']
    for tbl in tables:
        try:
            c.execute(f"SELECT COUNT(*) FROM {tbl}")
            print(f"  {tbl}: {c.fetchone()[0]} rows")
        except:
            print(f"  {tbl}: TABLE MISSING")

    try:
        c.execute("SELECT MIN(entrydate), MAX(entrydate) FROM logtrans")
        r = c.fetchone()
        if r and r[0]:
            print(f"  Date range: {r[0]} to {r[1]}")
    except:
        pass

    try:
        c.execute("SELECT data FROM coreapplication WHERE flag = 88888")
        r = c.fetchone()
        if r:
            print(f"  Login: OK")
        else:
            print(f"  Login: NO DATA (flag=88888)")
    except:
        print(f"  Login: ERROR")

    db.close()

print(f"\n{'='*60}")
print("  DONE")
print(f"{'='*60}")
