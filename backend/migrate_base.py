import pyodbc
import sqlite3
import json
import os
import sys
from decimal import Decimal
from datetime import datetime, timedelta

DEFAULT_SERVER = "idtemp.flexnotesuite.com,18180"
DEFAULT_USERNAME = "fxt"
DEFAULT_PASSWORD = "r3startsaja"

DRIVERS = [
    "ODBC Driver 18 for SQL Server",
    "ODBC Driver 17 for SQL Server",
    "SQL Server",
]

TRANSTYPE_IDS = (10, 11, 18, 19, 45, 47)
CHUNK_DAYS = 30
RECENT_TT45_DAYS = 5


def resolve_source_settings(target_db_name, db_dir):
    host = os.environ.get("DB_SOURCE_HOST")
    source_db = os.environ.get("DB_SOURCE_DB")
    username = os.environ.get("DB_SOURCE_USER")
    password = os.environ.get("DB_SOURCE_PASS")

    config_path = os.path.join(db_dir, "db_sources.json")
    config = {}
    try:
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as fh:
                parsed = json.load(fh)
                if isinstance(parsed, dict):
                    config = parsed
    except Exception as e:
        print(f"[WARN] Gagal membaca db_sources.json: {e}")

    source_entry = config.get(str(target_db_name).upper(), {}) if isinstance(config, dict) else {}

    if not host:
        host = source_entry.get("host") or DEFAULT_SERVER
    if not source_db:
        source_db = source_entry.get("database") or target_db_name
    if not username:
        username = source_entry.get("username") or DEFAULT_USERNAME
    if not password:
        password = source_entry.get("password") or DEFAULT_PASSWORD

    return host, source_db, username, password

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

class UniversalMigrator:
    def __init__(self, target_db_name, is_full_sync=False):
        self.target_db_name = target_db_name
        self.is_full_sync = is_full_sync
        self.mssql = None
        self.lite = None
        self.mc = None
        self.lc = None
        self.source_columns = {"logtrans": [], "logtransline": []}
        
        # Setup paths
        self.db_dir = os.environ.get('DB_DIR', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data')))
        self.db_path = os.path.join(self.db_dir, f"{self.target_db_name}.db")
        os.makedirs(self.db_dir, exist_ok=True)
        self.server, self.source_db_name, self.username, self.password = resolve_source_settings(self.target_db_name, self.db_dir)

    def connect(self):
        print(f"\n>>> Connecting to SQL Server for database: {self.source_db_name} ...")
        for driver in DRIVERS:
            conn_str = (
                f"DRIVER={{{driver}}};SERVER={self.server};DATABASE={self.source_db_name};"
                f"UID={self.username};PWD={self.password};TrustServerCertificate=yes;Encrypt=no;Connection Timeout=30;"
            )
            try:
                self.mssql = pyodbc.connect(conn_str)
                self.mc = self.mssql.cursor()
                print(f"    Connected using {driver} @ {self.server} as {self.username}")
                break
            except pyodbc.Error:
                continue
        
        if not self.mssql:
            print(f"    FAILED: Cannot connect to SQL Server database '{self.source_db_name}' @ {self.server}.")
            return False

        print(f"    Target SQLite: {self.db_path}")
        self.lite = sqlite3.connect(self.db_path)
        self.lc = self.lite.cursor()
        
        # Discover source columns
        self.discover_columns()
        return True

    def discover_columns(self):
        for table in ["logtrans", "logtransline"]:
            try:
                self.mc.execute(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}'")
                self.source_columns[table] = [r[0].lower() for r in self.mc.fetchall()]
            except Exception as e:
                print(f"      Warning: Could not discover columns for {table}: {e}")
                self.source_columns[table] = []

    def print_tt45_diagnostics(self, stage):
        try:
            self.mc.execute("SELECT COUNT(*), MIN(entrydate), MAX(entrydate) FROM [dbo].[logtrans] WHERE transtypeid = 45")
            src_total, src_min, src_max = self.mc.fetchone()
        except Exception as e:
            src_total, src_min, src_max = -1, None, None
            print(f"      [DIAG-{stage}] SOURCE TT45 check error: {e}")

        try:
            self.mc.execute(f"SELECT COUNT(*) FROM [dbo].[logtrans] WHERE transtypeid = 45 AND entrydate >= DATEADD(day, -{RECENT_TT45_DAYS}, GETDATE())")
            src_recent = self.mc.fetchone()[0]
        except Exception as e:
            src_recent = -1
            print(f"      [DIAG-{stage}] SOURCE TT45 recent check error: {e}")

        try:
            self.lc.execute("SELECT COUNT(*), MIN(entrydate), MAX(entrydate) FROM logtrans WHERE transtypeid = 45")
            sql_total, sql_min, sql_max = self.lc.fetchone()
            self.lc.execute("SELECT COUNT(*) FROM logtrans WHERE transtypeid = 45 AND entrydate >= datetime('now', '-5 day')")
            sql_recent = self.lc.fetchone()[0]
        except Exception as e:
            sql_total, sql_min, sql_max, sql_recent = -1, None, None, -1
            print(f"      [DIAG-{stage}] SQLITE TT45 check error: {e}")

        print(f"      [DIAG-{stage}] SOURCE TT45 total/min/max: {src_total} / {src_min} / {src_max}")
        print(f"      [DIAG-{stage}] SOURCE TT45 last{RECENT_TT45_DAYS}d: {src_recent}")
        print(f"      [DIAG-{stage}] SQLITE TT45 total/min/max: {sql_total} / {sql_min} / {sql_max}")
        print(f"      [DIAG-{stage}] SQLITE TT45 last{RECENT_TT45_DAYS}d: {sql_recent}")

    def transtype_sql_list(self):
        return ",".join(str(x) for x in TRANSTYPE_IDS)

    def incremental_start_date(self):
        # Keep enough history so production transactions (transtype 45)
        # are available for all databases in dashboard SQLite.
        return datetime(2024, 1, 1)

    def setup_schema(self):
        cur = self.lc
        # Force a clean sync by dropping old tables if they exist
        cur.execute("DROP TABLE IF EXISTS logtrans")
        cur.execute("DROP TABLE IF EXISTS logtransline")
        cur.execute("DROP TABLE IF EXISTS masteritem")
        cur.execute("DROP TABLE IF EXISTS masteritemgroup")
        cur.execute("DROP TABLE IF EXISTS mastercostcenter")
        cur.execute("DROP TABLE IF EXISTS masterrepresentative")
        cur.execute("DROP TABLE IF EXISTS masterwarehouse")
        cur.execute("DROP TABLE IF EXISTS masteruom")
        cur.execute("DROP TABLE IF EXISTS masteritemuom")
        cur.execute("DROP TABLE IF EXISTS stockview")
        cur.execute("DROP TABLE IF EXISTS flexnotesetting")
        cur.execute("DROP TABLE IF EXISTS coreapplication")

        cur.execute("""CREATE TABLE logtrans (
            logtransid INTEGER PRIMARY KEY,
            logtransentryno TEXT,
            entrydate TEXT,
            transtypeid INTEGER,
            logtransentrytext TEXT,
            freedescription1 TEXT,
            costcenterid INTEGER,
            representativeid INTEGER,
            createby TEXT,
            clientname TEXT,
            referenceno TEXT,
            totalvalue REAL
        )""")
        cur.execute("""CREATE TABLE logtransline (
            logtranslineid INTEGER PRIMARY KEY,
            logtransid INTEGER,
            itemid INTEGER,
            uomid INTEGER,
            warehouseid INTEGER,
            qty INTEGER,
            price REAL,
            netvalue REAL,
            pajakvalue REAL,
            hpp REAL,
            totalhpp REAL
        )""")
        # Master Tables
        cur.execute("CREATE TABLE masteritem (itemid INTEGER PRIMARY KEY, itemgroupid INTEGER, uomid INTEGER, itemcode TEXT, itemname TEXT)")
        cur.execute("CREATE TABLE masteritemgroup (itemgroupid INTEGER PRIMARY KEY, itemgroupcode TEXT, description TEXT)")
        cur.execute("CREATE TABLE mastercostcenter (costcenterid INTEGER PRIMARY KEY, costcentercode TEXT, description TEXT)")
        cur.execute("CREATE TABLE masterrepresentative (representativeid INTEGER PRIMARY KEY, representativecode TEXT, name TEXT)")
        cur.execute("CREATE TABLE masterwarehouse (warehouseid INTEGER PRIMARY KEY, warehousecode TEXT, description TEXT)")
        cur.execute("CREATE TABLE masteruom (uomid INTEGER PRIMARY KEY, uomcode TEXT, description TEXT)")
        cur.execute("""CREATE TABLE masteritemuom (
            itemuomid INTEGER PRIMARY KEY,
            itemid INTEGER,
            uomid INTEGER,
            conversionqty REAL,
            length REAL,
            width REAL,
            height REAL,
            depth REAL,
            weight REAL,
            volume REAL
        )""")
        cur.execute("CREATE TABLE stockview (itemid INTEGER, warehouseid INTEGER, debet REAL, credit REAL)")
        cur.execute("CREATE TABLE flexnotesetting (flexnotesettingid INTEGER PRIMARY KEY, settingtypecode TEXT, datachar1 TEXT, datachar2 TEXT)")
        cur.execute("CREATE TABLE coreapplication (flag INTEGER PRIMARY KEY, data TEXT)")
        
        cur.execute("CREATE INDEX IF NOT EXISTS idx_lt_date ON logtrans(entrydate)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_lt_type ON logtrans(transtypeid)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ltl_id ON logtransline(logtransid)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ltl_item_wh ON logtransline(itemid, warehouseid)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_item_wh ON stockview(itemid, warehouseid)")
        self.lite.commit()

    def migrate_masters(self):
        print(f"[{self.target_db_name}] Synchronizing master tables...")
        masters = {
            "masteritemgroup": ["itemgroupid", "itemgroupcode", "description"],
            "mastercostcenter": ["costcenterid", "costcentercode", "description"],
            "masterrepresentative": ["representativeid", "representativecode", "name"],
            "masteritem": ["itemid", "itemgroupid", "uomid", "itemcode", "itemname"],
            "masterwarehouse": ["warehouseid", "warehousecode", "description"],
            "masteruom": ["uomid", "uomcode", "description"],
            "masteritemuom": ["itemuomid", "itemid", "uomid", "conversionqty", "length", "width", "height", "depth", "weight", "volume"],
            "flexnotesetting": ["flexnotesettingid", "settingtypecode", "datachar1", "datachar2"],
        }
        
        for table, cols in masters.items():
            # Get actual columns in MSSQL to handle fallback (like itemname vs description)
            try:
                self.mc.execute(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}'")
                ms_cols = [r[0].lower() for r in self.mc.fetchall()]
                
                p_select = []
                for c in cols:
                    if c in ms_cols:
                        p_select.append(c)
                    elif c == "itemname" and "description" in ms_cols:
                        p_select.append("description as itemname")
                    elif c == "itemname" and "name" in ms_cols:
                        p_select.append("name as itemname")
                    else:
                        p_select.append(f"NULL as {c}")
                
                select_sql = f"SELECT {', '.join(p_select)} FROM {table}"
                self.mc.execute(select_sql)
                rows = self.mc.fetchall()
                
                placeholders = ", ".join(["?"] * len(cols))
                insert_sql = f"INSERT OR REPLACE INTO {table} ({', '.join(cols)}) VALUES ({placeholders})"
                
                self.lc.executemany(insert_sql, [tuple(r) for r in rows])
                print(f"  - {table}: {len(rows)} rows synced.")
            except Exception as e:
                print(f"  Warning: Skipping master table {table}: {e}")
            
        self.lite.commit()

    def migrate_stockview(self):
        print(f"[{self.target_db_name}] Synchronizing stockview...")
        try:
            self.lc.execute("DELETE FROM stockview")
            self.mc.execute("SELECT itemid, warehouseid, debet, credit FROM stockview")
            rows = self.mc.fetchall()
            if rows:
                self.lc.executemany(
                    "INSERT INTO stockview (itemid, warehouseid, debet, credit) VALUES (?,?,?,?)",
                    [convert_row(r) for r in rows]
                )
            self.lite.commit()
            print(f"  - stockview: {len(rows)} rows synced.")
        except Exception as e:
            print(f"  Warning: Skipping stockview: {e}")

    def migrate_chunked_logtrans(self):
        print(f"      Syncing logtrans (Full: {self.is_full_sync})...")
        try:
            # Determine range
            range_sql = f"SELECT MIN(entrydate), MAX(entrydate), COUNT(*) FROM [dbo].[logtrans] WHERE transtypeid IN ({self.transtype_sql_list()})"
            self.mc.execute(range_sql)
            res = self.mc.fetchone()
            if not res or res[0] is None:
                print(f"      [SKIP] No logtrans data found in {self.target_db_name}")
                return
            s_min, s_max, s_total = res

            print(f"      [OK] Total {s_total} rows found. Range: {s_min} to {s_max}")
            
            current_start = s_min
            if isinstance(current_start, str):
                current_start = datetime.strptime(current_start[:19], '%Y-%m-%d %H:%M:%S')
            
            if not self.is_full_sync:
                limit_date = self.incremental_start_date()
                if current_start < limit_date:
                    current_start = limit_date

            target_max = s_max
            if isinstance(target_max, str):
                target_max = datetime.strptime(target_max[:19], '%Y-%m-%d %H:%M:%S')

            # Build Dynamic Query for logtrans
            cols = self.source_columns["logtrans"]
            p_select = [
                "logtransid", "logtransentryno", "entrydate", "transtypeid", "logtransentrytext",
                "freedescription1" if "freedescription1" in cols else "NULL",
                "costcenterid" if "costcenterid" in cols else "NULL",
                "representativeid" if "representativeid" in cols else "NULL",
                "createby" if "createby" in cols else "NULL",
                "clientname" if "clientname" in cols else ("CAST(custid AS VARCHAR)" if "custid" in cols else "NULL"),
                "referenceno" if "referenceno" in cols else ("reference1" if "reference1" in cols else "NULL"),
                "totalvalue" if "totalvalue" in cols else ("netvalueinput" if "netvalueinput" in cols else ("netvalue" if "netvalue" in cols else "0"))
            ]

            sel_str = ", ".join(p_select)
            sql = f"SELECT {sel_str} FROM [dbo].[logtrans] WHERE transtypeid IN ({self.transtype_sql_list()}) AND entrydate >= ? AND entrydate < ?"

            total_migrated = 0
            while current_start <= target_max:
                current_end = current_start + timedelta(days=CHUNK_DAYS)
                s_str = current_start.strftime('%Y-%m-%d %H:%M:%S')
                e_str = current_end.strftime('%Y-%m-%d %H:%M:%S')
                
                self.mc.execute(sql, (s_str, e_str))
                rows = self.mc.fetchall()
                converted = [convert_row(row) for row in rows]
                
                if converted:
                    self.lc.executemany("""INSERT OR REPLACE INTO logtrans 
                        (logtransid, logtransentryno, entrydate, transtypeid, logtransentrytext, 
                         freedescription1, costcenterid, representativeid, createby, clientname, referenceno, totalvalue)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""", converted)
                    self.lite.commit()
                    total_migrated += len(rows)
                
                print(f"        {current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')} : {len(rows)} synced (Total: {total_migrated})")
                current_start = current_end
            
            print(f"      Finished logtrans: {total_migrated} rows synced.")
        except Exception as e:
            print(f"\n      [ERROR] logtrans in {self.target_db_name}: {e}")

    def migrate_chunked_logtransline(self):
        print(f"      Syncing logtransline for {self.target_db_name} (Full: {self.is_full_sync})...")
        try:
            self.mc.execute(f"SELECT MIN(entrydate), MAX(entrydate) FROM [dbo].[logtrans] WHERE transtypeid IN ({self.transtype_sql_list()})")
            res = self.mc.fetchone()
            if not res or res[0] is None: return
            s_min, s_max = res[0], res[1]

            current_start = s_min
            if isinstance(current_start, str):
                current_start = datetime.strptime(current_start[:19], '%Y-%m-%d %H:%M:%S')
            
            if not self.is_full_sync:
                limit_date = self.incremental_start_date()
                if current_start < limit_date:
                    current_start = limit_date

            target_max = s_max
            if isinstance(target_max, str):
                target_max = datetime.strptime(target_max[:19], '%Y-%m-%d %H:%M:%S')

            # Robust mapping for logtransline
            cols = self.source_columns["logtransline"]
            p_select = [
                "ltl.logtranslineid", "ltl.logtransid", "ltl.itemid",
                "ltl.uomid" if "uomid" in cols else "NULL",
                "ltl.warehouseid" if "warehouseid" in cols else "NULL",
                "ltl.quantity" if "quantity" in cols else ("ltl.qty" if "qty" in cols else ("ltl.qtyinput" if "qtyinput" in cols else "0")),
                "ltl.price" if "price" in cols else ("ltl.priceinput" if "priceinput" in cols else "0"),
                "ltl.netvalue" if "netvalue" in cols else ("ltl.netvalueinput" if "netvalueinput" in cols else "0"),
                "ltl.pajakvalue" if "pajakvalue" in cols else "0",
                "ltl.hpp" if "hpp" in cols else "0",
                "ltl.totalhpp" if "totalhpp" in cols else "0"
            ]

            sel_str = ", ".join(p_select)
            sql = f"""SELECT {sel_str} FROM [dbo].[logtransline] ltl
                     INNER JOIN [dbo].[logtrans] lt ON ltl.logtransid = lt.logtransid
                     WHERE lt.transtypeid IN ({self.transtype_sql_list()})
                     AND lt.entrydate >= ? AND lt.entrydate < ?"""

            total_migrated = 0
            while current_start <= target_max:
                current_end = current_start + timedelta(days=CHUNK_DAYS)
                s_str = current_start.strftime('%Y-%m-%d %H:%M:%S')
                e_str = current_end.strftime('%Y-%m-%d %H:%M:%S')
                
                self.mc.execute(sql, (s_str, e_str))
                rows = self.mc.fetchall()
                converted = [convert_row(row) for row in rows]
                
                if converted:
                    self.lc.executemany("""INSERT OR REPLACE INTO logtransline
                        (logtranslineid, logtransid, itemid, uomid, warehouseid, qty, price, netvalue, pajakvalue, hpp, totalhpp)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?)""", converted)
                    self.lite.commit()
                    total_migrated += len(rows)
                
                print(f"        Lines {current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')} : {len(rows)} synced (Total: {total_migrated})")
                current_start = current_end
            print(f"\n      Finished logtransline: {total_migrated} rows synced.")
        except Exception as e:
            print(f"\n      [ERROR] logtransline in {self.target_db_name}: {e}")

    def migrate_recent_tt45(self):
        print(f"      Forcing TT45 sync for last {RECENT_TT45_DAYS} days...")
        try:
            lt_cols = self.source_columns["logtrans"]
            lt_select = [
                "logtransid", "logtransentryno", "entrydate", "transtypeid", "logtransentrytext",
                "freedescription1" if "freedescription1" in lt_cols else "NULL",
                "costcenterid" if "costcenterid" in lt_cols else "NULL",
                "representativeid" if "representativeid" in lt_cols else "NULL",
                "createby" if "createby" in lt_cols else "NULL",
                "clientname" if "clientname" in lt_cols else ("CAST(custid AS VARCHAR)" if "custid" in lt_cols else "NULL"),
                "referenceno" if "referenceno" in lt_cols else ("reference1" if "reference1" in lt_cols else "NULL"),
                "totalvalue" if "totalvalue" in lt_cols else ("netvalueinput" if "netvalueinput" in lt_cols else ("netvalue" if "netvalue" in lt_cols else "0")),
            ]

            lt_sql = f"""
                SELECT {", ".join(lt_select)}
                FROM [dbo].[logtrans]
                WHERE transtypeid = 45
                  AND entrydate >= DATEADD(day, -{RECENT_TT45_DAYS}, GETDATE())
            """
            self.mc.execute(lt_sql)
            lt_rows = [convert_row(r) for r in self.mc.fetchall()]
            if lt_rows:
                self.lc.executemany("""
                    INSERT OR REPLACE INTO logtrans
                    (logtransid, logtransentryno, entrydate, transtypeid, logtransentrytext,
                     freedescription1, costcenterid, representativeid, createby, clientname, referenceno, totalvalue)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                """, lt_rows)
                self.lite.commit()
            print(f"        TT45 logtrans synced: {len(lt_rows)} rows")

            ltl_cols = self.source_columns["logtransline"]
            ltl_select = [
                "ltl.logtranslineid", "ltl.logtransid", "ltl.itemid",
                "ltl.uomid" if "uomid" in ltl_cols else "NULL",
                "ltl.warehouseid" if "warehouseid" in ltl_cols else "NULL",
                "ltl.quantity" if "quantity" in ltl_cols else ("ltl.qty" if "qty" in ltl_cols else ("ltl.qtyinput" if "qtyinput" in ltl_cols else "0")),
                "ltl.price" if "price" in ltl_cols else ("ltl.priceinput" if "priceinput" in ltl_cols else "0"),
                "ltl.netvalue" if "netvalue" in ltl_cols else ("ltl.netvalueinput" if "netvalueinput" in ltl_cols else "0"),
                "ltl.pajakvalue" if "pajakvalue" in ltl_cols else "0",
                "ltl.hpp" if "hpp" in ltl_cols else "0",
                "ltl.totalhpp" if "totalhpp" in ltl_cols else "0",
            ]

            ltl_sql = f"""
                SELECT {", ".join(ltl_select)}
                FROM [dbo].[logtransline] ltl
                INNER JOIN [dbo].[logtrans] lt ON ltl.logtransid = lt.logtransid
                WHERE lt.transtypeid = 45
                  AND lt.entrydate >= DATEADD(day, -{RECENT_TT45_DAYS}, GETDATE())
            """
            self.mc.execute(ltl_sql)
            ltl_rows = [convert_row(r) for r in self.mc.fetchall()]
            if ltl_rows:
                self.lc.executemany("""
                    INSERT OR REPLACE INTO logtransline
                    (logtranslineid, logtransid, itemid, uomid, warehouseid, qty, price, netvalue, pajakvalue, hpp, totalhpp)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """, ltl_rows)
                self.lite.commit()
            print(f"        TT45 logtransline synced: {len(ltl_rows)} rows")

            if len(lt_rows) == 0:
                print("      [WARN] TT45 source last 5 hari kosong (logtrans)")
            if len(lt_rows) > 0 and len(ltl_rows) == 0:
                print("      [WARN] TT45 logtrans ada tapi logtransline kosong untuk 5 hari terakhir")

        except Exception as e:
            print(f"      [ERROR] recent TT45 sync in {self.target_db_name}: {e}")

    def finalize(self):
        if self.mssql: self.mssql.close()
        if self.lite: self.lite.close()

def run_sync(db_name, is_full=False):
    target_db = os.environ.get("DB_SOURCE_DB", db_name)
    migrator = UniversalMigrator(target_db, is_full)
    if migrator.connect():
        migrator.print_tt45_diagnostics("BEFORE")
        migrator.setup_schema()
        migrator.migrate_masters()
        migrator.migrate_stockview()
        migrator.migrate_chunked_logtrans()
        migrator.migrate_chunked_logtransline()
        migrator.migrate_recent_tt45()
        migrator.print_tt45_diagnostics("AFTER")
        migrator.finalize()
        print(f"Sync complete for {db_name}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate_base.py <db_name> [--full]")
        sys.exit(1)
    
    db = sys.argv[1]
    full = "--full" in sys.argv
    run_sync(db, full)
