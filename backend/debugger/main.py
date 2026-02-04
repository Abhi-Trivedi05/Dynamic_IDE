from fastapi import FastAPI
from pydantic import BaseModel

from analyzer.resolver import resolve
from analyzer.snapshot import load_snapshot, save_snapshot
from diff.compare import diff_snapshots

app = FastAPI()

class DebugRequest(BaseModel):
    entry_file: str
    user_prompt: str

@app.post("/debug")
def debug_code(req: DebugRequest):
    current_output = resolve(req.entry_file)

    previous_output = load_snapshot(req.entry_file)

    diff_output = diff_snapshots(previous_output, current_output)

    save_snapshot(req.entry_file, current_output)

    return {
        "entry_file": req.entry_file,
        "changed_files": diff_output,
        "prompt": req.user_prompt
    }
