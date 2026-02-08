import subprocess
from typing import Iterator

def stream_command(cmd: str, cwd: str) -> Iterator[str]:
    process = subprocess.Popen(
        ["cmd.exe", "/c", cmd],
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    for line in process.stdout:
        yield line

    process.wait()