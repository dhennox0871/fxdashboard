import sqlite3
conn = sqlite3.connect(r'c:\laragon\www\oslank\go_backend\oslank.db')
c = conn.cursor()

# Search for anything like customerinfo
c.execute("SELECT settingtypecode, datachar1, datachar2 FROM flexnotesetting WHERE settingtypecode LIKE '%customer%'")
rows = c.fetchall()
print("LIKE customer:", rows)

# Also check total and unique settingtypecodes
c.execute("SELECT DISTINCT settingtypecode FROM flexnotesetting LIMIT 30")
codes = [r[0] for r in c.fetchall()]
print("\nDistinct codes (first 30):", codes)

conn.close()
