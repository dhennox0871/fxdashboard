import pyodbc
import sqlite3
import json
import os
import sys
from decimal import Decimal
from datetime import datetime, timedelta, timezone

# --- SQL Server Connection Config ---
SERVER = "idtemp.flexnotesuite.com,18180"
USERNAME = "fxt"
PASSWORD = "r3startsaja"

DRIVERS = [
    "ODBC Driver 18 for SQL Server",
    "ODBC Driver 17 for SQL Server",
    "SQL Server",
]

TRANSTYPE_IDS = (10, 11, 18, 19, 47)
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

    def setup_schema(self):
        self.lc.executescript("""
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
        CREATE INDEX IF NOT EXISTS idx_logtrans_entrydate ON logtrans(entrydate);
        CREATE INDEX IF NOT EXISTS idx_logtrans_transtypeid ON logtrans(transtypeid);
        CREATE INDEX IF NOT EXISTS idx_logtransline_logtransid ON logtransline(logtransid);
        """)
        self.lite.commit()

    def get_col_sql(self, table, logical_name, candidates, default="NULL"):
        cols = self.source_columns[table]
        for c in candidates:
            # If candidate is a direct column name
            if c.lower() in cols:
                return c
            # Simple handling of cast and ltl. prefixes
            clean_c = c.split(".")[-1] if "." in c else c
            if clean_c.lower() in cols:
                return c
        return default

    def migrate_chunked_logtrans(self):
        print(f"      Syncing logtrans (Full: {self.is_full_sync})...")
        try:
            # Determine range
            range_sql = f"SELECT MIN(entrydate), MAX(entrydate), COUNT(*) FROM [dbo].[logtrans] WHERE transtypeid IN (10,11,18,19,47)"
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
                limit_date = datetime.now() - timedelta(days=180)
                if current_start < limit_date:
                    current_start = limit_date

            target_max = s_max
            if isinstance(target_max, str):
                target_max = datetime.strptime(target_max[:19], '%Y-%m-%d %H:%M:%S')

            # Build Dynamic Query for logtrans
            cols = self.source_columns["logtrans"]
            p_select = [
                "logtransid", "logtransentryno", "entrydate", "transtypeid", "logtransentrytext",
                "costcenterid" if "costcenterid" in cols else "NULL",
                "representativeid" if "representativeid" in cols else "NULL",
                "createby" if "createby" in cols else "NULL",
                "clientname" if "clientname" in cols else ("CAST(custid AS VARCHAR)" if "custid" in cols else "NULL"),
                "referenceno" if "referenceno" in cols else ("reference1" if "reference1" in cols else "NULL"),
                "totalvalue" if "totalvalue" in cols else ("netvalueinput" if "netvalueinput" in cols else ("netvalue" if "netvalue" in cols else "0"))
            ]

            sel_str = ", ".join(p_select)
            sql = f"SELECT {sel_str} FROM [dbo].[logtrans] WHERE transtypeid IN (10,11,18,19,47) AND entrydate >= ? AND entrydate < ?"

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
                         costcenterid, representativeid, createby, clientname, referenceno, totalvalue)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?)""", converted)
                    self.lite.commit()
                    total_migrated += len(rows)
                
                print(f"        {current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')} : {len(rows)} synced (Total: {total_migrated})")
                current_start = current_end
            
            print(f"      Finished logtrans: {total_migrated} rows synced.")
        except Exception as e:
            print(f"\n      [ERROR] logtrans in {self.target_db_name}: {e}")
            import traceback
            traceback.print_exc()

    def migrate_chunked_logtransline(self):
        print(f"      Syncing logtransline for {self.target_db_name} (Full: {self.is_full_sync})...")
        try:
            self.mc.execute(f"SELECT MIN(entrydate), MAX(entrydate) FROM [dbo].[logtrans] WHERE transtypeid IN (10,11,18,19,47)")
            res = self.mc.fetchone()
            if not res or res[0] is None: return
            s_min, s_max = res[0], res[1]

            current_start = s_min
            if isinstance(current_start, str):
                current_start = datetime.strptime(current_start[:19], '%Y-%m-%d %H:%M:%S')
            
            if not self.is_full_sync:
                limit_date = datetime.now() - timedelta(days=180)
                if current_start < limit_date:
                    current_start = limit_date

            target_max = s_max
            if isinstance(target_max, str):
                target_max = datetime.strptime(target_max[:19], '%Y-%m-%d %H:%M:%S')

            # Robust mapping for logtransline
            cols = self.source_columns["logtransline"]
            p_select = [
                "ltl.logtranslineid", "ltl.logtransid", "ltl.itemid",
                "ltl.itemcode" if "itemcode" in cols else ("ltl.itemcoderef" if "itemcoderef" in cols else ("ltl.syncitemcode" if "syncitemcode" in cols else "NULL")),
                "ltl.itemname" if "itemname" in cols else ("ltl.description" if "description" in cols else "'Unknown Item'"),
                "ltl.quantity" if "quantity" in cols else ("ltl.qty" if "qty" in cols else ("ltl.qtyinput" if "qtyinput" in cols else "0")),
                "ltl.uom" if "uom" in cols else ("CAST(ltl.uomid AS VARCHAR)" if "uomid" in cols else "NULL"),
                "ltl.price" if "price" in cols else ("ltl.priceinput" if "priceinput" in cols else "0"),
                "ltl.netvalue" if "netvalue" in cols else ("ltl.netvalueinput" if "netvalueinput" in cols else "0"),
                "ltl.pajakvalue" if "pajakvalue" in cols else "0"
            ]

            sel_str = ", ".join(p_select)
            sql = f"""SELECT {sel_str} FROM [dbo].[logtransline] ltl
                     INNER JOIN [dbo].[logtrans] lt ON ltl.logtransid = lt.logtransid
                     WHERE lt.transtypeid IN (10,11,18,19,47)
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
                        (logtranslineid, logtransid, itemid, itemcode, itemname, quantity, uom, price, netvalue, pajakvalue)
                        VALUES (?,?,?,?,?,?,?,?,?,?)""", converted)
                    self.lite.commit()
                    total_migrated += len(rows)
                
                print(f"        Lines {current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')} : {len(rows)} synced (Total: {total_migrated})")
                current_start = current_end
            print(f"\n      Finished logtransline: {total_migrated} rows synced.")
        except Exception as e:
            print(f"\n      [ERROR] logtransline in {self.target_db_name}: {e}")
            import traceback
            traceback.print_exc()

    def finalize(self):
        if self.mssql: self.mssql.close()
        if self.lite: self.lite.close()

def run_sync(db_name, is_full=False):
    migrator = UniversalMigrator(db_name, is_full)
    if migrator.connect():
        migrator.setup_schema()
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
