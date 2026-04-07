import os

def split_file(file_path, chunk_size=50*1024*1024): # 50MB
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return
    
    file_size = os.path.getsize(file_path)
    part_num = 1
    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            part_path = f"{file_path}.part{part_num:03d}"
            with open(part_path, 'wb') as part_f:
                part_f.write(chunk)
            print(f"Created {part_path} ({len(chunk)} bytes)")
            part_num += 1

if __name__ == "__main__":
    split_file("data/SKSMRT.db")
    # Mark original for ignore or deletion after split to save push space
    # os.rename("data/SKSMRT.db", "data/SKSMRT.db.bak")
