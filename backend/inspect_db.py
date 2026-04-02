import sqlite3

conn = sqlite3.connect(r'c:\laragon\www\oslank\go_backend\OSLANK_fcsdata.db')
c = conn.cursor()

with open(r'c:\laragon\www\oslank\go_backend\db_report.md', 'w', encoding='utf-8') as f:
    f.write("# Database Report\n\n")
    
    f.write("## Tables\n")
    c.execute("SELECT name, sql FROM sqlite_master WHERE type='table'")
    for row in c.fetchall():
        f.write(f"\n### Table: {row[0]}\n```sql\n{row[1]}\n```\n")
    
    f.write("\n## Data: fxkey\n")
    c.execute("SELECT * FROM fxkey")
    cols = [d[0] for d in c.description]
    f.write(f"Columns: {cols}\n\n")
    for row in c.fetchall():
        f.write(f"{row}\n")
    
    # Check all tables
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in c.fetchall()]
    for tbl in tables:
        if tbl == 'sqlite_sequence':
            continue
        c.execute(f"SELECT COUNT(*) FROM [{tbl}]")
        count = c.fetchone()[0]
        f.write(f"\nTable [{tbl}] has {count} rows\n")

conn.close()
print("Done! Report saved to db_report.md")
