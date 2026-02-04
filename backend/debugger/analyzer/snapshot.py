import json
import os
from utils.hash import snapshot_key

SNAPSHOT_DIR = "history/snapshots"
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

def _snapshot_path(entry_file):
    key = snapshot_key(entry_file)
    return os.path.join(SNAPSHOT_DIR, f"{key}.json")

def load_snapshot(entry_file):
    path = _snapshot_path(entry_file)
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)

def save_snapshot(entry_file, data):
    path = _snapshot_path(entry_file)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
