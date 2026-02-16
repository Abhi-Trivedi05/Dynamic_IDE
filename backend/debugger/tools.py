import os
import subprocess
import time
import threading
import queue
import patch_ng
import tempfile

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

#------------PATCH---------------
def apply_unified_patch(path:str, unified_str: str):

    path = os.path.abspath(path)
    root_dir = os.path.dirname(path)
    
    with tempfile.NamedTemporaryFile(delete=False, mode='w', encoding='utf-8') as tmp:
        tmp.write(unified_str)
        tmp_path = tmp.name

    p = patch_ng.fromfile(tmp_path)

    if not p:
        raise Exception("invalid patch format")

    success = p.apply(root=root_dir)
    os.remove(tmp_path)
    if not success:
        raise Exception("Patch failed to apply cleanly")

    # Read updated content
    with open(path, "r", encoding="utf-8") as f:
        return f.read()
    

# path = "sample.txt"

# patch_str = """\
# --- sample.txt
# +++ sample.txt
# @@ -6,3 +6,3 @@
#  nothing
# -change again
# +changed
#  to anything
# """

# print(apply_unified_patch(r"C:\Users\Apurav\Downloads\Dynamic_IDE\sample.txt", patch_str))
    

# ---------- TERMINAL ----------
def run_command(cmd, cwd, time_limit):
    time_limit = int(time_limit)
    time_limit = min(time_limit, 15)
    print(f"Running command: {cmd} in {cwd} for {time_limit}s")

    process = subprocess.Popen(
        cmd,
        cwd=cwd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    q = queue.Queue()

    def reader_thread(pipe, queue):
        for line in iter(pipe.readline, ""):
            queue.put(line)
        pipe.close()

    thread = threading.Thread(
        target=reader_thread,
        args=(process.stdout, q),
        daemon=True
    )
    thread.start()

    start = time.time()
    output = []

    while True:
        # ⏱ timeout check (NOW WORKS)
        if time.time() - start >= time_limit:
            process.terminate()
            break

        # process finished
        if process.poll() is not None:
            break

        try:
            # non-blocking read
            line = q.get(timeout=0.1)
            output.append(line)
        except queue.Empty:
            pass

    # drain remaining output
    while not q.empty():
        output.append(q.get())

    return {
        "stdout": "".join(output),
        "stderr": "",
        "exit_code": process.poll(),
        "timed_out": (time.time() - start) >= time_limit
    }