"""
Migrasi 3 database dari SQL Server ke SQLite3.
Server: oslsrg.flexnotesuite.com,18180
Databases: oslsrg, oslank, oslken
"""
import pyodbc
import sqlite3
import json
import os
import sys
from decimal import Decimal

SERVER = "oslsrg.flexnotesuite.com,18180"
USERNAME = "dhen"
PASSWORD = "abcMulyosari"
DATABASES = ["oslsrg", "oslank", "oslken"]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Try connecting with available drivers
def connect_mssql(database):
    drivers = [
        "ODBC Driver 17 for SQL Server",
        "ODBC Driver 18 for SQL Server",
        "SQL Server",
    ]
    for driver in drivers:
        conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={SERVER};"
            f"DATABASE={database};"
            f"UID={USERNAME};"
            f"PWD={PASSWORD};"
            f"TrustServerCertificate=yes;"
            f"Encrypt=no;"
            f"Connection Timeout=30;"
        )
        try:
            conn = pyodbc.connect(conn_str)
            return conn, driver
        except pyodbc.Error:
            continue
    return None, None


def convert_row(row):
    result = []
    for val in row:
        if isinstance(val, Decimal):
            result.append(float(val))
        elif isinstance(val, bytes):
            result.append(val.decode('utf-8', errors='replace'))
        else:
            result.append(val)
    return tuple(result)


def migrate_table(mc, lc, lite, table_name, select_sql, insert_sql):
    try:
        mc.execute(select_sql)
        rows = mc.fetchall()
        converted = [convert_row(row) for row in rows]
        if converted:
            lc.executemany(insert_sql, converted)
            lite.commit()
        print(f"    {table_name}: {len(rows)} rows")
        return len(rows)
    except Exception as e:
        print(f"    {table_name}: ERROR - {e}")
        return 0


def create_sqlite_tables(lc):
    lc.executescript("""
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

    CREATE TABLE IF NOT EXISTS logtransline (
        logtranslineid INTEGER PRIMARY KEY,
        logtransid INTEGER,
        itemid INTEGER,
        netvalue REAL,
        pajakvalue REAL
    );

    CREATE TABLE IF NOT EXISTS masteritem (
        itemid INTEGER PRIMARY KEY,
        itemgroupid INTEGER
    );

    CREATE TABLE IF NOT EXISTS masteritemgroup (
        itemgroupid INTEGER PRIMARY KEY,
        itemgroupcode TEXT,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS mastercostcenter (
        costcenterid INTEGER PRIMARY KEY,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS masterrepresentative (
        representativeid INTEGER PRIMARY KEY,
        name TEXT
    );

    CREATE TABLE IF NOT EXISTS flexnotesetting (
        flexnotesettingid INTEGER PRIMARY KEY,
        settingtypecode TEXT,
        datachar1 TEXT,
        datachar2 TEXT
    );

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


def migrate_database(db_name):
    print(f"\n{'='*60}")
    print(f"  MIGRATING: {db_name}")
    print(f"{'='*60}")

    # Connect to SQL Server
    mssql, driver = connect_mssql(db_name)
    if mssql is None:
        print(f"  FAILED: Cannot connect to {db_name}")
        return False
    print(f"  Connected with: {driver}")
    mc = mssql.cursor()

    # Check available tables
    mc.execute("""
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME
    """)
    all_tables = [row[0] for row in mc.fetchall()]

    dashboard_tables = ['logtrans', 'logtransline', 'masteritem', 'masteritemgroup',
                        'mastercostcenter', 'masterrepresentative', 'flexnotesetting']
    available = {}
    for tbl in dashboard_tables:
        matched = [t for t in all_tables if t.lower() == tbl.lower()]
        if matched:
            available[tbl] = matched[0]

    print(f"  Tables found: {len(available)}/{len(dashboard_tables)}")

    # Create SQLite
    db_path = os.path.join(SCRIPT_DIR, f'{db_name}.db')
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"  Removed old: {db_name}.db")

    lite = sqlite3.connect(db_path)
    lc = lite.cursor()
    create_sqlite_tables(lc)
    print(f"  SQLite tables created")

    # Migrate data
    print(f"  Migrating data...")

    if 'logtrans' in available:
        a = available['logtrans']
        migrate_table(mc, lc, lite, 'logtrans',
            f"""SELECT logtransid, logtransentryno, 
               CONVERT(varchar, entrydate, 120) as entrydate,
               transtypeid, logtransentrytext, costcenterid, representativeid, createby
               FROM [{a}] 
               WHERE transtypeid IN (10, 18)
               AND entrydate >= DATEADD(day, -180, GETDATE())""",
            "INSERT INTO logtrans VALUES (?,?,?,?,?,?,?,?)")

    if 'logtransline' in available and 'logtrans' in available:
        a_ltl = available['logtransline']
        a_lt = available['logtrans']
        migrate_table(mc, lc, lite, 'logtransline',
            f"""SELECT ltl.logtranslineid, ltl.logtransid, ltl.itemid, ltl.netvalue, ltl.pajakvalue
               FROM [{a_ltl}] ltl
               INNER JOIN [{a_lt}] lt ON ltl.logtransid = lt.logtransid
               WHERE lt.transtypeid IN (10, 18)
               AND lt.entrydate >= DATEADD(day, -180, GETDATE())""",
            "INSERT INTO logtransline VALUES (?,?,?,?,?)")

    if 'masteritem' in available:
        a = available['masteritem']
        migrate_table(mc, lc, lite, 'masteritem',
            f"SELECT itemid, itemgroupid FROM [{a}]",
            "INSERT INTO masteritem VALUES (?,?)")

    if 'masteritemgroup' in available:
        a = available['masteritemgroup']
        migrate_table(mc, lc, lite, 'masteritemgroup',
            f"SELECT itemgroupid, itemgroupcode, description FROM [{a}]",
            "INSERT INTO masteritemgroup VALUES (?,?,?)")

    if 'mastercostcenter' in available:
        a = available['mastercostcenter']
        migrate_table(mc, lc, lite, 'mastercostcenter',
            f"SELECT costcenterid, description FROM [{a}]",
            "INSERT INTO mastercostcenter VALUES (?,?)")

    if 'masterrepresentative' in available:
        a = available['masterrepresentative']
        migrate_table(mc, lc, lite, 'masterrepresentative',
            f"SELECT representativeid, name FROM [{a}]",
            "INSERT INTO masterrepresentative VALUES (?,?)")

    if 'flexnotesetting' in available:
        a = available['flexnotesetting']
        migrate_table(mc, lc, lite, 'flexnotesetting',
            f"SELECT flexnotesettingid, settingtypecode, datachar1, datachar2 FROM [{a}]",
            "INSERT INTO flexnotesetting VALUES (?,?,?,?)")

    # Insert default login user
    user_data = json.dumps({
        "users": [
            {"username": "admin", "password": "admin123", "role": "admin"},
        ]
    })
    now = "2026-04-02 09:00:00"
    lc.execute("""
        INSERT INTO coreapplication 
        (classname, dataid, title, description, category, enabled, flag, majorversion, minorversion, data, visible, createby, createdate, modifyby, modifydate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('DashboardAuth', 'DASHLOGIN', 'Dashboard Login', 'User credentials for Flexnote Dashboard', 'dashboard', 1, 88888, 1, 0, user_data, 1, 'SYSTEM', now, 'SYSTEM', now))
    lite.commit()
    print(f"    Login user: admin / admin123")

    # Verification
    print(f"  Verification:")
    for tbl in ['logtrans', 'logtransline', 'masteritem', 'masteritemgroup', 'mastercostcenter', 'masterrepresentative', 'flexnotesetting', 'coreapplication']:
        lc.execute(f"SELECT COUNT(*) FROM {tbl}")
        print(f"    {tbl}: {lc.fetchone()[0]} rows")

    lc.execute("SELECT MIN(entrydate), MAX(entrydate) FROM logtrans")
    r = lc.fetchone()
    if r and r[0]:
        print(f"    Date range: {r[0]} to {r[1]}")

    file_size = os.path.getsize(db_path)
    print(f"    File size: {file_size / 1024:.1f} KB ({file_size / (1024*1024):.2f} MB)")

    mssql.close()
    lite.close()
    print(f"  DONE: {db_name}.db")
    return True


# ========== MAIN ==========
if __name__ == '__main__':
    print("=" * 60)
    print("  SQL Server -> SQLite3 Migration")
    print(f"  Server: {SERVER}")
    print(f"  Databases: {', '.join(DATABASES)}")
    print("=" * 60)

    results = {}
    for db_name in DATABASES:
        success = migrate_database(db_name)
        results[db_name] = success

    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for db_name, success in results.items():
        status = "OK" if success else "FAILED"
        db_path = os.path.join(SCRIPT_DIR, f'{db_name}.db')
        size = ""
        if success and os.path.exists(db_path):
            size = f" ({os.path.getsize(db_path) / (1024*1024):.2f} MB)"
        print(f"  {db_name}: {status}{size}")
    print(f"{'='*60}")
