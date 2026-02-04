import hashlib

def snapshot_key(entry_file: str) -> str:
    return hashlib.sha256(entry_file.encode()).hexdigest()[:16]
