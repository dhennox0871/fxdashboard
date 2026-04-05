"""
Migrasi data dari SQL Server (sksmrt) ke SQLite3 untuk Flexnote Dashboard.
Server: idtemp.flexnotesuite.com,18180
Database: sksmrt
Hanya mengekspor kolom-kolom yang dibutuhkan oleh API dashboard.
"""
import pyodbc
import sqlite3
import json
import os
import sys
from decimal import Decimal

# --- SQL Server Connection ---
SERVER = "idtemp.flexnotesuite.com,18180"
DATABASE = "sksmrt"
USERNAME = "fxt"
PASSWORD = "r3startsaja"

drivers = [
    "ODBC Driver 17 for SQL Server",
    "ODBC Driver 18 for SQL Server",
    "SQL Server",
]

mssql = None
for driver in drivers:
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={SERVER};"
        f"DATABASE={DATABASE};"
        f"UID={USERNAME};"
        f"PWD={PASSWORD};"
        f"TrustServerCertificate=yes;"
        f"Encrypt=no;"
        f"Connection Timeout=30;"
    )
    try:
        print(f"Trying driver: {driver} ...")
        mssql = pyodbc.connect(conn_str)
        print(f"✅ Connected with driver: {driver}")
        break
    except pyodbc.Error as e:
        print(f"  ❌ Failed: {e}")
        continue

if mssql is None:
    print("\n❌ GAGAL: Tidak bisa connect ke SQL Server.")
    print("   Pastikan ODBC driver terinstall dan server reachable.")
    sys.exit(1)

mc = mssql.cursor()

# --- First, inspect available tables ---
print("\n=== Checking available tables ===")
mc.execute("""
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' 
    ORDER BY TABLE_NAME
""")
tables = [row[0] for row in mc.fetchall()]
print(f"Found {len(tables)} tables:")
for t in tables:
    print(f"  - {t}")

# Check which dashboard tables exist
dashboard_tables = ['logtrans', 'logtransline', 'masteritem', 'masteritemgroup', 
                    'mastercostcenter', 'masterrepresentative', 'flexnotesetting', 'coreapplication']
print("\n=== Dashboard table availability ===")
available_tables = {}
for tbl in dashboard_tables:
    # Case-insensitive check
    matched = [t for t in tables if t.lower() == tbl.lower()]
    if matched:
        mc.execute(f"SELECT COUNT(*) FROM [{matched[0]}]")
        count = mc.fetchone()[0]
        available_tables[tbl] = matched[0]  # store actual name
        print(f"  ✅ {tbl}: {count} rows")
    else:
        print(f"  ❌ {tbl}: NOT FOUND")

if not available_tables:
    print("\n❌ Tidak ada tabel dashboard yang ditemukan!")
    sys.exit(1)

# SQLite Connection
# Robust path: use DB_DIR env (for Docker) or fallback to local sibling data/ folder
db_dir = os.environ.get('DB_DIR', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data')))
db_path = os.path.join(db_dir, 'sksmrt.db')

# Ensure the directory exists (important for Docker volumes)
os.makedirs(os.path.dirname(db_path), exist_ok=True)

lite = sqlite3.connect(db_path)
lc = lite.cursor()
print(f"SQLite database: {db_path}")

# Drop tables to ensure fresh migration without deleting the file
lc.executescript("""
DROP TABLE IF EXISTS logtrans;
DROP TABLE IF EXISTS logtransline;
DROP TABLE IF EXISTS masteritem;
DROP TABLE IF EXISTS masteritemgroup;
DROP TABLE IF EXISTS mastercostcenter;
DROP TABLE IF EXISTS masterrepresentative;
DROP TABLE IF EXISTS flexnotesetting;
DROP TABLE IF EXISTS coreapplication;
""")

# ========== CREATE TABLES ==========

lc.executescript("""
-- logtrans (hanya kolom yang dipakai dashboard)
CREATE TABLE IF NOT EXISTS logtrans (
    logtransid INTEGER PRIMARY KEY,
    logtransentryno TEXT,
    entrydate TEXT,
    transtypeid INTEGER,
    logtransentrytext TEXT,
    costcenterid INTEGER,
    representativeid INTEGER,
    createby TEXT
);

-- logtransline (hanya kolom yang dipakai dashboard)
CREATE TABLE IF NOT EXISTS logtransline (
    logtranslineid INTEGER PRIMARY KEY,
    logtransid INTEGER,
    itemid INTEGER,
    netvalue REAL,
    pajakvalue REAL
);

-- masteritem (hanya kolom yang dipakai)
CREATE TABLE IF NOT EXISTS masteritem (
    itemid INTEGER PRIMARY KEY,
    itemgroupid INTEGER
);

-- masteritemgroup
CREATE TABLE IF NOT EXISTS masteritemgroup (
    itemgroupid INTEGER PRIMARY KEY,
    itemgroupcode TEXT,
    description TEXT
);

-- mastercostcenter
CREATE TABLE IF NOT EXISTS mastercostcenter (
    costcenterid INTEGER PRIMARY KEY,
    description TEXT
);

-- masterrepresentative
CREATE TABLE IF NOT EXISTS masterrepresentative (
    representativeid INTEGER PRIMARY KEY,
    name TEXT
);

-- flexnotesetting (hanya kolom yang dipakai)
CREATE TABLE IF NOT EXISTS flexnotesetting (
    flexnotesettingid INTEGER PRIMARY KEY,
    settingtypecode TEXT,
    datachar1 TEXT,
    datachar2 TEXT
);

-- coreapplication (untuk login)
CREATE TABLE IF NOT EXISTS coreapplication (
    coreapplicationid INTEGER PRIMARY KEY AUTOINCREMENT,
    classname TEXT NOT NULL DEFAULT '',
    dataid TEXT NOT NULL DEFAULT '',
    title TEXT,
    description TEXT,
    category TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    flag INTEGER NOT NULL DEFAULT 0,
    majorversion INTEGER NOT NULL DEFAULT 0,
    minorversion INTEGER NOT NULL DEFAULT 0,
    data TEXT,
    visible INTEGER,
    dataformat INTEGER,
    datatype INTEGER,
    reservedint1 INTEGER,
    reservedtext1 TEXT,
    reserveddatetime1 TEXT,
    createby TEXT NOT NULL DEFAULT '',
    createdate TEXT NOT NULL DEFAULT '',
    modifyby TEXT NOT NULL DEFAULT '',
    modifydate TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_logtrans_entrydate ON logtrans(entrydate);
CREATE INDEX IF NOT EXISTS idx_logtrans_transtypeid ON logtrans(transtypeid);
CREATE INDEX IF NOT EXISTS idx_logtransline_logtransid ON logtransline(logtransid);
CREATE INDEX IF NOT EXISTS idx_logtransline_itemid ON logtransline(itemid);
CREATE INDEX IF NOT EXISTS idx_coreapplication_flag ON coreapplication(flag);
""")
print("Tables created.")

# ========== MIGRATE DATA ==========

def convert_row(row):
    """Convert Decimal, bytes, and other unsupported types to Python native types."""
    result = []
    for val in row:
        if isinstance(val, Decimal):
            result.append(float(val))
        elif isinstance(val, bytes):
            result.append(val.decode('utf-8', errors='replace'))
        else:
            result.append(val)
    return tuple(result)

def migrate(table, actual_name, select_sql, insert_sql, params_count):
    """Migrate data from SQL Server to SQLite."""
    try:
        mc.execute(select_sql)
        rows = mc.fetchall()
        converted = [convert_row(row) for row in rows]
        if converted:
            lc.executemany(insert_sql, converted)
            lite.commit()
        print(f"  {table}: {len(rows)} rows migrated")
    except Exception as e:
        print(f"  ⚠️ {table}: ERROR - {e}")

print("\nMigrating data...")

# logtrans
if 'logtrans' in available_tables:
    actual = available_tables['logtrans']
    # Filter only last 180 days to keep sync fast
    print(f"  Filtering logtrans for last 180 days...")
    migrate('logtrans', actual,
        f"""SELECT logtransid, logtransentryno, 
           CONVERT(varchar, entrydate, 120) as entrydate,
           transtypeid, logtransentrytext, costcenterid, representativeid, createby
           FROM [{actual}] 
           WHERE transtypeid IN (10, 11, 18, 19) 
           AND entrydate >= DATEADD(day, -180, GETDATE())""",
        "INSERT INTO logtrans VALUES (?,?,?,?,?,?,?,?)", 8)

# logtransline (hanya transaksi penjualan)
if 'logtransline' in available_tables and 'logtrans' in available_tables:
    actual_ltl = available_tables['logtransline']
    actual_lt = available_tables['logtrans']
    migrate('logtransline', actual_ltl,
        f"""SELECT ltl.logtranslineid, ltl.logtransid, ltl.itemid, ltl.netvalue, ltl.pajakvalue
           FROM [{actual_ltl}] ltl
           INNER JOIN [{actual_lt}] lt ON ltl.logtransid = lt.logtransid
           WHERE lt.transtypeid IN (10, 11, 18, 19)
           AND lt.entrydate >= DATEADD(day, -180, GETDATE())""",
        "INSERT INTO logtransline VALUES (?,?,?,?,?)", 5)

# masteritem
if 'masteritem' in available_tables:
    actual = available_tables['masteritem']
    migrate('masteritem', actual,
        f"SELECT itemid, itemgroupid FROM [{actual}]",
        "INSERT INTO masteritem VALUES (?,?)", 2)

# masteritemgroup
if 'masteritemgroup' in available_tables:
    actual = available_tables['masteritemgroup']
    migrate('masteritemgroup', actual,
        f"SELECT itemgroupid, itemgroupcode, description FROM [{actual}]",
        "INSERT INTO masteritemgroup VALUES (?,?,?)", 3)

# mastercostcenter
if 'mastercostcenter' in available_tables:
    actual = available_tables['mastercostcenter']
    migrate('mastercostcenter', actual,
        f"SELECT costcenterid, description FROM [{actual}]",
        "INSERT INTO mastercostcenter VALUES (?,?)", 2)

# masterrepresentative
if 'masterrepresentative' in available_tables:
    actual = available_tables['masterrepresentative']
    migrate('masterrepresentative', actual,
        f"SELECT representativeid, name FROM [{actual}]",
        "INSERT INTO masterrepresentative VALUES (?,?)", 2)

# flexnotesetting
if 'flexnotesetting' in available_tables:
    actual = available_tables['flexnotesetting']
    migrate('flexnotesetting', actual,
        f"SELECT flexnotesettingid, settingtypecode, datachar1, datachar2 FROM [{actual}]",
        "INSERT INTO flexnotesetting VALUES (?,?,?,?)", 4)

# ========== INSERT DEFAULT LOGIN USER ==========
print("\nInserting default dashboard login user (flag=88888)...")
user_data = json.dumps({
    "users": [
        {"username": "admin", "password": "admin123", "role": "admin"},
    ]
})
now_str = "2026-04-02 09:00:00"
lc.execute("DELETE FROM coreapplication WHERE flag = 88888")
lc.execute("""
    INSERT INTO coreapplication 
    (classname, dataid, title, description, category, enabled, flag, majorversion, minorversion, data, visible, createby, createdate, modifyby, modifydate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", ('DashboardAuth', 'DASHLOGIN', 'Dashboard Login', 'User credentials for Flexnote Dashboard', 'dashboard', 1, 88888, 1, 0, user_data, 1, 'SYSTEM', now_str, 'SYSTEM', now_str))

# ========== INSERT LAST SYNC TIMESTAMP ==========
from datetime import datetime
sync_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
print(f"\nRecording last sync time: {sync_time} (flag=99999)...")
lc.execute("DELETE FROM coreapplication WHERE flag = 99999")
lc.execute("""
    INSERT INTO coreapplication 
    (classname, dataid, title, description, category, enabled, flag, data, createby, createdate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", ('DashboardMeta', 'LASTSYNC', 'Last Sync', 'Last successful data migration', 'metadata', 1, 99999, sync_time, 'SYSTEM', sync_time))

lite.commit()
print(f"  Default user created: admin / admin123")
print(f"  Last sync recorded.")

# ========== VERIFY ==========
print("\n=== VERIFICATION ===")
for tbl in ['logtrans', 'logtransline', 'masteritem', 'masteritemgroup', 'mastercostcenter', 'masterrepresentative', 'flexnotesetting', 'coreapplication']:
    lc.execute(f"SELECT COUNT(*) FROM {tbl}")
    print(f"  {tbl}: {lc.fetchone()[0]} rows")

# Verify login data
lc.execute("SELECT data FROM coreapplication WHERE flag = 88888")
row = lc.fetchone()
if row:
    print(f"\n  Login data (flag=88888): {row[0]}")

# Show date range
lc.execute("SELECT MIN(entrydate), MAX(entrydate) FROM logtrans")
date_range = lc.fetchone()
if date_range and date_range[0]:
    print(f"\n  Data range: {date_range[0]} to {date_range[1]}")

# Show file size
file_size = os.path.getsize(db_path)
print(f"\n  File size: {file_size / 1024:.1f} KB ({file_size / (1024*1024):.2f} MB)")

mssql.close()
lite.close()
print("\n✅ Migration complete! File: sksmrt.db")
