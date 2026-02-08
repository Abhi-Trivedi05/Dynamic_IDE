import os
import subprocess

# ---------- FILESYSTEM ----------

def list_files(path):
    result = []
    for root, dirs, files in os.walk(path):
        if os.path.basename(root) == "node_modules":
            result.append(root)
            dirs.clear()   # stop walking inside node_modules
            continue
        
        # print(f"Checking {root} with {len(files)} files")
        if len(files) > 20:
            dirs.clear()
            continue
        
        for f in files:
            result.append(os.path.join(root, f))
    return result

def read_file(path):
    print(f"Reading file: {path}")
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def write_file(path, content):
    print(f"Writing to file: {path}")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def delete_file(path):
    if os.path.exists(path):
        os.remove(path)

# ---------- TERMINAL ----------

def run_command(cmd, cwd):
    print(f"Running command: {cmd} in {cwd}")
    process = subprocess.run(
        cmd,
        cwd=cwd,
        shell=True,
        capture_output=True,
        text=True
    )
    return {
        "stdout": process.stdout,
        "stderr": process.stderr,
        "exit_code": process.returncode
    }