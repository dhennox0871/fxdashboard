import pyodbc
import sys

SERVER = "idtemp.flexnotesuite.com,18180"
DATABASE = "sksmrt"
USERNAME = "fxt"
PASSWORD = "r3startsaja"
drivers = ["ODBC Driver 17 for SQL Server", "ODBC Driver 18 for SQL Server", "SQL Server"]

conn = None
for driver in drivers:
    try:
        conn = pyodbc.connect(f"DRIVER={{{driver}}};SERVER={SERVER};DATABASE={DATABASE};UID={USERNAME};PWD={PASSWORD};TrustServerCertificate=yes;Encrypt=no;")
        break
    except: continue

if not conn: sys.exit(1)
cursor = conn.cursor()

for table in ['logtrans', 'logtransline']:
    print(f"\n--- {table} ---")
    cursor.execute(f"SELECT TOP 1 * FROM [{table}]")
    print(", ".join([col[0] for col in cursor.description]))

conn.close()
