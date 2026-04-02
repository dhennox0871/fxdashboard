"""
Script untuk mengekspor data dari SQL Server ke SQLite3.
Tulis output ke file agar tidak terpotong.
"""
import pyodbc

conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost,1433;"
    "DATABASE=oslank;"
    "UID=fxadmin18;"
    "PWD=r3startsaja;"
    "TrustServerCertificate=yes;"
)

try:
    conn = pyodbc.connect(conn_str)
except:
    try:
        conn = pyodbc.connect(conn_str.replace("ODBC Driver 17 for SQL Server", "SQL Server"))
    except:
        conn = pyodbc.connect(conn_str.replace("ODBC Driver 17 for SQL Server", "ODBC Driver 18 for SQL Server"))

cursor = conn.cursor()
out = []

# 1. Dashboard tables row counts
dashboard_tables = ['logtrans', 'logtransline', 'masteritem', 'masteritemgroup', 
                    'mastercostcenter', 'masterrepresentative', 'flexnotesetting', 'coreapplication']
out.append("=== DASHBOARD TABLES ===")
for t in dashboard_tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM [{t}]")
        cnt = cursor.fetchone()[0]
        out.append(f"  {t}: {cnt} rows")
    except:
        out.append(f"  {t}: NOT FOUND")

# 2. Coreapplication schema
out.append("\n=== COREAPPLICATION SCHEMA ===")
cursor.execute("""
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'coreapplication'
    ORDER BY ORDINAL_POSITION
""")
for c in cursor.fetchall():
    out.append(f"  {c[0]}: {c[1]}({c[2]}) nullable={c[3]}")

# 3. Coreapplication sample
out.append("\n=== COREAPPLICATION SAMPLE (last 5 rows) ===")
cursor.execute("SELECT TOP 5 * FROM coreapplication ORDER BY coreapplicationid DESC")
cols_desc = [d[0] for d in cursor.description]
out.append(f"  Columns: {cols_desc}")
for row in cursor.fetchall():
    out.append(f"  {[str(x)[:80] for x in row]}")

# 4. Check if flag 88888 exists
out.append("\n=== COREAPPLICATION WHERE flag=88888 ===")
cursor.execute("SELECT * FROM coreapplication WHERE flag = 88888")
rows = cursor.fetchall()
if rows:
    for row in rows:
        out.append(f"  {[str(x)[:80] for x in row]}")
else:
    out.append("  No rows found with flag=88888 (we will create one)")

# 5. Schemas of all dashboard tables
for t in dashboard_tables:
    out.append(f"\n=== SCHEMA: {t} ===")
    try:
        cursor.execute(f"""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = '{t}'
            ORDER BY ORDINAL_POSITION
        """)
        for c in cursor.fetchall():
            out.append(f"  {c[0]}: {c[1]}({c[2]})")
    except:
        out.append("  NOT FOUND")

conn.close()

report = "\n".join(out)
with open(r'c:\laragon\www\oslank\go_backend\sqlserver_report.md', 'w', encoding='utf-8') as f:
    f.write(report)
print("Report written to sqlserver_report.md")
