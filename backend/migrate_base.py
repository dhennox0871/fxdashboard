import pyodbc
import sqlite3
import json
import os
import sys
from decimal import Decimal
from datetime import datetime, timedelta

# --- SQL Server Connection Config ---
SERVER = os.environ.get("DB_SOURCE_HOST", "idtemp.flexnotesuite.com,18180")
USERNAME = os.environ.get("DB_SOURCE_USER", "fxt")
PASSWORD = os.environ.get("DB_SOURCE_PASS", "r3startsaja")

DRIVERS = [
    "ODBC Driver 18 for SQL Server",
    "ODBC Driver 17 for SQL Server",
    "SQL Server",
]

TRANSTYPE_IDS = (10, 11, 18, 19, 45, 47)
CHUNK_DAYS = 30

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

    def connect(self):
        print(f"\n>>> Connecting to SQL Server for database: {self.target_db_name} ...")
        for driver in DRIVERS:
            conn_str = (
                f"DRIVER={{{driver}}};SERVER={SERVER};DATABASE={self.target_db_name};"
                f"UID={USERNAME};PWD={PASSWORD};TrustServerCertificate=yes;Encrypt=no;Connection Timeout=30;"
            )
            try:
                self.mssql = pyodbc.connect(conn_str)
                self.mc = self.mssql.cursor()
                print(f"    Connected using {driver}")
                break
            except pyodbc.Error:
                continue
        
        if not self.mssql:
            print(f"    FAILED: Cannot connect to SQL Server database '{self.target_db_name}'.")
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

    def transtype_sql_list(self):
        return ",".join(str(x) for x in TRANSTYPE_IDS)

    def incremental_start_date(self):
        # SKSMRT production (transtype 45) can be needed beyond 180 days.
        if str(self.target_db_name).lower() == "sksmrt":
            return datetime(2024, 1, 1)
        return datetime.now() - timedelta(days=180)

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

    def finalize(self):
        if self.mssql: self.mssql.close()
        if self.lite: self.lite.close()

def run_sync(db_name, is_full=False):
    target_db = os.environ.get("DB_SOURCE_DB", db_name)
    migrator = UniversalMigrator(target_db, is_full)
    if migrator.connect():
        migrator.setup_schema()
        migrator.migrate_masters()
        migrator.migrate_stockview()
        migrator.migrate_chunked_logtrans()
        migrator.migrate_chunked_logtransline()
        migrator.finalize()
        print(f"Sync complete for {db_name}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate_base.py <db_name> [--full]")
        sys.exit(1)
    
    db = sys.argv[1]
    full = "--full" in sys.argv
    run_sync(db, full)
