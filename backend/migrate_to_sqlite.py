"""
Migrasi data dari SQL Server ke SQLite3 untuk Flexnote Dashboard.
Hanya mengekspor kolom-kolom yang dibutuhkan oleh API dashboard.
"""
import pyodbc
import sqlite3
import json
import os

# --- SQL Server Connection ---
mssql_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=idtemp.flexnotesuite.com,18180;"
    "DATABASE=oslank;"
    "UID=fxadmin18;"
    "PWD=r3startsaja;"
    "TrustServerCertificate=yes;"
    "Encrypt=no;"
)
try:
    mssql = pyodbc.connect(mssql_str)
except:
    try:
        mssql = pyodbc.connect(mssql_str.replace("ODBC Driver 17 for SQL Server", "SQL Server"))
    except:
        mssql = pyodbc.connect(mssql_str.replace("ODBC Driver 17 for SQL Server", "ODBC Driver 18 for SQL Server"))

mc = mssql.cursor()
print("Connected to SQL Server.")

# --- SQLite Connection ---
# Use the data/ directory as defined in the dashboard's .env
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'oslank.db'))
# if os.path.exists(db_path):
#     os.remove(db_path)
lite = sqlite3.connect(db_path)
lc = lite.cursor()
print(f"SQLite database: {db_path}")

# Drop tables to ensure fresh migration
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
    """Convert Decimal and other unsupported types to Python native types."""
    from decimal import Decimal
    result = []
    for val in row:
        if isinstance(val, Decimal):
            result.append(float(val))
        elif isinstance(val, bytes):
            result.append(val.decode('utf-8', errors='replace'))
        else:
            result.append(val)
    return tuple(result)

def migrate(table, select_sql, insert_sql, params_count):
    mc.execute(select_sql)
    rows = mc.fetchall()
    converted = [convert_row(row) for row in rows]
    lc.executemany(insert_sql, converted)
    lite.commit()
    print(f"  {table}: {len(rows)} rows migrated")

print("\nMigrating data...")

# logtrans
migrate('logtrans',
    """SELECT logtransid, logtransentryno, 
       CONVERT(varchar, entrydate, 120) as entrydate,
       transtypeid, logtransentrytext, costcenterid, representativeid, createby
       FROM logtrans 
       WHERE transtypeid IN (10, 11, 18, 19)
       AND entrydate >= DATEADD(day, -180, GETDATE())""",
    "INSERT INTO logtrans VALUES (?,?,?,?,?,?,?,?)", 8)

# logtransline (hanya transaksi penjualan)
migrate('logtransline',
    """SELECT ltl.logtranslineid, ltl.logtransid, ltl.itemid, ltl.netvalue, ltl.pajakvalue
       FROM logtransline ltl
       INNER JOIN logtrans lt ON ltl.logtransid = lt.logtransid
       WHERE lt.transtypeid IN (10, 11, 18, 19)
       AND lt.entrydate >= DATEADD(day, -180, GETDATE())""",
    "INSERT INTO logtransline VALUES (?,?,?,?,?)", 5)

# masteritem
migrate('masteritem',
    "SELECT itemid, itemgroupid FROM masteritem",
    "INSERT INTO masteritem VALUES (?,?)", 2)

# masteritemgroup
migrate('masteritemgroup',
    "SELECT itemgroupid, itemgroupcode, description FROM masteritemgroup",
    "INSERT INTO masteritemgroup VALUES (?,?,?)", 3)

# mastercostcenter
migrate('mastercostcenter',
    "SELECT costcenterid, description FROM mastercostcenter",
    "INSERT INTO mastercostcenter VALUES (?,?)", 2)

# masterrepresentative
migrate('masterrepresentative',
    "SELECT representativeid, name FROM masterrepresentative",
    "INSERT INTO masterrepresentative VALUES (?,?)", 2)

# flexnotesetting
migrate('flexnotesetting',
    "SELECT flexnotesettingid, settingtypecode, datachar1, datachar2 FROM flexnotesetting",
    "INSERT INTO flexnotesetting VALUES (?,?,?,?)", 4)

# ========== INSERT DEFAULT LOGIN USER ==========
print("\nInserting default dashboard login user (flag=88888)...")
user_data = json.dumps({
    "users": [
        {"username": "admin", "password": "admin123", "role": "admin"},
    ]
})
now_str = "2026-04-01 17:00:00"
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

mssql.close()
lite.close()
print("\n✅ Migration complete! File: oslank.db")
