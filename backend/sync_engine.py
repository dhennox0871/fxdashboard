import pyodbc
import sqlite3
import json
import os
import sys
import argparse
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# Helper to convert SQL Server data types to SQLite compatible types
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

def migrate_table(mc, lc, lite, table_name, select_sql, insert_sql, param_count):
    try:
        mc.execute(select_sql)
        rows = mc.fetchall()
        converted = [convert_row(row) for row in rows]
        if converted:
            placeholder = ",".join(["?"] * param_count)
            # Use INSERT OR REPLACE for incremental support
            lc.executemany(insert_sql, converted)
            lite.commit()
        print(f"    ✅ {table_name}: {len(rows)} rows processed")
        return len(rows)
    except Exception as e:
        print(f"    ❌ {table_name}: ERROR - {e}")
        return 0

def create_schema(lc):
    lc.executescript("""
    CREATE TABLE IF NOT EXISTS logtrans (
        logtransid INTEGER PRIMARY KEY,
        logtransentryno TEXT,
        entrydate TEXT,
        transtypeid INTEGER,
        logtransentrytext TEXT,
        costcenterid INTEGER,
        representativeid INTEGER,
        createby TEXT,
        clientname TEXT,
        referenceno TEXT,
        totalvalue REAL
    );

    CREATE TABLE IF NOT EXISTS logtransline (
        logtranslineid INTEGER PRIMARY KEY,
        logtransid INTEGER,
        itemid INTEGER,
        itemcode TEXT,
        itemname TEXT,
        quantity REAL,
        uom TEXT,
        price REAL,
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
        createby TEXT NOT NULL DEFAULT '',
        createdate TEXT NOT NULL DEFAULT '',
        modifyby TEXT NOT NULL DEFAULT '',
        modifydate TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_lt_date ON logtrans(entrydate);
    CREATE INDEX IF NOT EXISTS idx_lt_type ON logtrans(transtypeid);
    CREATE INDEX IF NOT EXISTS idx_ltl_id ON logtransline(logtransid);
    """)

def main():
    parser = argparse.ArgumentParser(description='Unified Sync Engine')
    parser.add_argument('--host', required=True)
    parser.add_argument('--db', required=True)
    parser.add_argument('--user', required=True)
    parser.add_argument('--password', required=True)
    parser.add_argument('--driver', default='ODBC Driver 17 for SQL Server')
    parser.add_argument('--days', type=int, default=0) # 0 means Full Sync
    args = parser.parse_args()

    print(f"\n🚀 Starting Sync for: {args.db} on {args.host}")
    
    # 1. Connect to MSSQL (Auto-detect driver)
    drivers = [
        args.driver, # First try user's choice
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
        "SQL Server",
    ]
    
    mssql = None
    last_error = ""
    for driver in drivers:
        if driver == "": continue
        conn_str = (
            f"DRIVER={{{driver}}};SERVER={args.host};DATABASE={args.db};"
            f"UID={args.user};PWD={args.password};TrustServerCertificate=yes;Encrypt=no;"
        )
        try:
            mssql = pyodbc.connect(conn_str, timeout=30)
            print(f"  ✅ Connected using: {driver}")
            break
        except Exception as e:
            last_error = str(e)
            continue

    if not mssql:
        print(f"  ❌ FAILED: Connection error: {last_error}")
        sys.exit(1)
    
    mc = mssql.cursor()

    # 2. Setup SQLite
    db_dir = os.environ.get('DB_DIR', './data')
    db_path = os.path.join(db_dir, f"{args.db.lower()}.db")
    os.makedirs(db_dir, exist_ok=True)
    
    lite = sqlite3.connect(db_path)
    lc = lite.cursor()
    create_schema(lc)
    
    # 3. Check for existing data to decide sync mode
    lc.execute("SELECT COUNT(*) FROM logtrans")
    existing_count = lc.fetchone()[0]
    
    sync_filter = ""
    # Use args.days if provided, or default to 180 if incremental
    days = args.days if args.days > 0 else 180
    
    if existing_count > 0 and args.days != -1: # -1 is force full sync
        sync_filter = f"AND entrydate >= DATEADD(day, -{days}, GETDATE())"
        print(f"  🔄 Incremental Sync mode ({days} days)")
    else:
        print(f"  📥 Full Sync mode (Initial fetch)")

    # 4. Migrate Tables
    print(f"  Migrating data...")
    
    # logtrans
    migrate_table(mc, lc, lite, 'logtrans',
        f"""SELECT logtransid, logtransentryno, CONVERT(varchar, entrydate, 120),
           transtypeid, logtransentrytext, costcenterid, representativeid, createby,
           clientname, referenceno, totalvalue
           FROM logtrans WHERE transtypeid IN (10, 11, 18, 19) {sync_filter}""",
        "INSERT OR REPLACE INTO logtrans VALUES (?,?,?,?,?,?,?,?,?,?,?)", 11)

    # logtransline
    migrate_table(mc, lc, lite, 'logtransline',
        f"""SELECT ltl.logtranslineid, ltl.logtransid, ltl.itemid, ltl.itemcode, ltl.itemname, 
           ltl.quantity, ltl.uom, ltl.price, ltl.netvalue, ltl.pajakvalue
           FROM logtransline ltl 
           INNER JOIN logtrans lt ON ltl.logtransid = lt.logtransid
           WHERE lt.transtypeid IN (10, 11, 18, 19) {sync_filter}""",
        "INSERT OR REPLACE INTO logtransline VALUES (?,?,?,?,?,?,?,?,?,?)", 10)

    # Masters (Always refresh)
    migrate_table(mc, lc, lite, 'masteritem', "SELECT itemid, itemgroupid FROM masteritem", "INSERT OR REPLACE INTO masteritem VALUES (?,?)", 2)
    migrate_table(mc, lc, lite, 'masteritemgroup', "SELECT itemgroupid, itemgroupcode, description FROM masteritemgroup", "INSERT OR REPLACE INTO masteritemgroup VALUES (?,?,?)", 3)
    migrate_table(mc, lc, lite, 'mastercostcenter', "SELECT costcenterid, description FROM mastercostcenter", "INSERT OR REPLACE INTO mastercostcenter VALUES (?,?)", 2)
    migrate_table(mc, lc, lite, 'masterrepresentative', "SELECT representativeid, name FROM masterrepresentative", "INSERT OR REPLACE INTO masterrepresentative VALUES (?,?)", 2)
    migrate_table(mc, lc, lite, 'flexnotesetting', "SELECT flexnotesettingid, settingtypecode, datachar1, datachar2 FROM flexnotesetting WHERE UPPER(settingtypecode) = 'CUSTOMERINFO1'", 
                  "INSERT OR REPLACE INTO flexnotesetting VALUES (?,?,?,?)", 4)

    # 5. Auth & Sync Timestamp
    user_json = json.dumps({"users": [{"username": "admin", "password": "admin123", "role": "admin"}]})
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Insert default admin if missing
    lc.execute("SELECT COUNT(*) FROM coreapplication WHERE flag = 88888")
    if lc.fetchone()[0] == 0:
        lc.execute("INSERT INTO coreapplication (classname, dataid, title, flag, data, createby, createdate, modifyby, modifydate) VALUES (?,?,?,?,?,?,?,?,?)",
                   ('DashboardAuth', 'DASHLOGIN', 'Dashboard Login', 88888, user_json, 'SYSTEM', now_str, 'SYSTEM', now_str))

    # Recording last sync time (Jakarta)
    tz = timezone(timedelta(hours=7))
    sync_time = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    lc.execute("DELETE FROM coreapplication WHERE flag = 99999")
    lc.execute("INSERT INTO coreapplication (classname, dataid, title, flag, data, createby, createdate) VALUES (?,?,?,?,?,?,?)",
               ('SyncInfo', 'LASTSYNC', 'Last Synchronized', 99999, sync_time, 'SYSTEM', now_str))

    lite.commit()
    mssql.close()
    lite.close()
    print(f"✨ DONE: Sync complete at {sync_time}\n")

if __name__ == '__main__':
    main()
