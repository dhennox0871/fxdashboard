import os
import sys
import subprocess

# --- Config ---
DATABASES = ['OSLSRG', 'OSLKEN', 'OSLANK', 'SKSMRT']
PYTHON_EXEC = sys.executable
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MIGRATE_SCRIPT = os.path.join(BASE_DIR, 'migrate_base.py')

def main():
    full_sync = '--full' in sys.argv
    print(f"=== Multi-Database Sync Started (Full: {full_sync}) ===")
    
    for db in DATABASES:
        print(f"\n--- Syncing {db} ---")
        cmd = [PYTHON_EXEC, MIGRATE_SCRIPT, db]
        if full_sync:
            cmd.append('--full')
        
        try:
            # Use subprocess to run each database sync
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in process.stdout:
                print(f"[{db}] {line.strip()}")
            process.wait()
            
            if process.returncode == 0:
                print(f"Sync complete for {db}")
            else:
                print(f"Sync failed for {db} with return code {process.returncode}")
        except Exception as e:
            print(f"Error syncing {db}: {e}")

    print("\n=== All Database Syncs Completed ===")

if __name__ == "__main__":
    main()
