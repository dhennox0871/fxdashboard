import sqlite3
import os

db_dir = os.environ.get('DB_DIR', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data')))
db_path = os.path.join(db_dir, 'sksmrt.db')
if not os.path.exists(db_path):
    print("ERROR: sksmrt.db not found!")
    exit(1)

db = sqlite3.connect(db_path)
c = db.cursor()

print("=== SKSMRT DATABASE VERIFICATION ===")
print(f"File: {db_path}")
size = os.path.getsize(db_path)
print(f"Size: {size / 1024:.1f} KB ({size / (1024*1024):.2f} MB)")

print("\n--- Row Counts ---")
tables = ['logtrans', 'logtransline', 'masteritem', 'masteritemgroup',
          'mastercostcenter', 'masterrepresentative', 'flexnotesetting', 'coreapplication']
for tbl in tables:
    try:
        c.execute(f"SELECT COUNT(*) FROM {tbl}")
        print(f"  {tbl}: {c.fetchone()[0]} rows")
    except Exception as e:
        print(f"  {tbl}: ERROR - {e}")

print("\n--- Date Range ---")
c.execute("SELECT MIN(entrydate), MAX(entrydate) FROM logtrans")
r = c.fetchone()
if r and r[0]:
    print(f"  From: {r[0]}")
    print(f"  To:   {r[1]}")
else:
    print("  No data in logtrans!")

print("\n--- Login User ---")
c.execute("SELECT data FROM coreapplication WHERE flag = 88888")
r = c.fetchone()
if r:
    print(f"  Login data: {r[0]}")
else:
    print("  No login data found (flag=88888)!")

print("\n--- Sample logtrans ---")
c.execute("SELECT logtransid, logtransentryno, entrydate, transtypeid, createby FROM logtrans LIMIT 5")
for row in c.fetchall():
    print(f"  {row}")

db.close()
print("\nDone!")
