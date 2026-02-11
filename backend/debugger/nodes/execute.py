from tools import write_file, run_command, read_file
import os

def ExecuteNode(state):
    step = state["current_step"]
    cwd = state["cwd"]

    if not step:
        return state

    # record executed step
    state["execution_history"].append(step)

    # -------------------------
    # READ / OPEN
    # -------------------------
    if step.startswith(("read::", "open::")):
        try:
            _, path = step.split("::", 1)
            full_path = os.path.join(cwd, path)

            content = read_file(full_path)

            # persist file context
            state["file_context"][path] = content
            print("read_content: ", content[:100])

            # also expose to planner as recent output
            state["last_output"] = (
                f"[READ FILE: {path}]\n{content}"
            )

            return state

        except Exception as e:
            state["error"] = f"Failed to read {step}: {str(e)}"
            return state

    # -------------------------
    # WRITE
    # -------------------------
    if step.startswith("write::"):
        try:
            _, path, content = step.split("::", 2)
            write_file(os.path.join(cwd, path), content)
            return state
        except Exception as e:
            state["error"] = f"Failed to write {step}: {str(e)}"
            return state

    # -------------------------
    # RUN
    # -------------------------
    if step.startswith("run::"):
        _,cmd, time = step.split("::", 2)
        result = run_command(cmd, cwd, time)
        output = result["stdout"] + result["stderr"]

        state["runtime_context"].append(
            f"[COMMAND]: {cmd}\n{output}"
        )
        state["last_output"] = output

        if result["exit_code"] != 0:
            state["error"] = output
        
        print("command_output: ", output)

        return state

    # -------------------------
    # UNKNOWN STEP
    # -------------------------
    state["error"] = f"Unknown command: {step}"
    return state