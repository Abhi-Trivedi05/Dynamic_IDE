from tools import write_file, run_command, read_file, str_replace
import os
from versioning.manager import save_version

def ExecuteNode(state):
    step = state["current_step"]
    cwd = state["cwd"]

    if not step:
        return state

    # record executed step (convert to string representation for history)
    if isinstance(step, dict):
        step_repr = f"{step['name']}({step['parameters']})"
    else:
        step_repr = step
    state["execution_history"].append(step_repr)

    # Handle new JSON tool-call format
    if isinstance(step, dict):
        tool_name = step.get("name")
        params = step.get("parameters", {})

        # -------------------------
        # read_file
        # -------------------------
        if tool_name == "read_file":
            try:
                path = params.get("path")
                if not path:
                    state["error"] = "read_file: missing 'path' parameter"
                    return state

                full_path = os.path.join(cwd, path)
                content = read_file(full_path)

                # persist file context
                state["file_context"][path] = content
                print("read_content: ", content[:100])

                # expose to planner as recent output
                state["last_output"] = f"[READ FILE: {path}]\n{content}"
                return state

            except Exception as e:
                state["error"] = f"Failed to read_file: {str(e)}"
                return state

        # -------------------------
        # str_replace (patch/modify existing file)
        # -------------------------
        if tool_name == "str_replace":
            try:
                path = params.get("path")
                old_str = params.get("old_str")
                new_str = params.get("new_str")

                if not path or old_str is None or new_str is None:
                    state["error"] = "str_replace: missing required parameters (path, old_str, new_str)"
                    return state

                full_path = os.path.join(cwd, path)
                
                # Read the original content
                result = str_replace(full_path, old_str, new_str)
                if not result.startswith("OK"):
                    state["error"] = f"str_replace failed: {result}"
                    return state
                print(f"patched file: {path}")
                state["last_output"] = f"[PATCHED FILE: {path}]"
                return state

            except Exception as e:
                state["error"] = f"Failed to str_replace: {str(e)}"
                return state

        # -------------------------
        # write_file (create or overwrite)
        # -------------------------
        if tool_name == "write_file":
            try:
                path = params.get("path")
                content = params.get("content")

                if not path or content is None:
                    state["error"] = "write_file: missing required parameters (path, content)"
                    return state

                full_path = os.path.join(cwd, path)
                write_file(full_path, content)
                print(f"wrote file: {full_path}")
                state["last_output"] = f"[WROTE FILE: {path}]"
                return state

            except Exception as e:
                state["error"] = f"Failed to write_file: {str(e)}"
                return state

        # -------------------------
        # run_command
        # -------------------------
        if tool_name == "run_command":
            try:
                cmd = params.get("command")
                time_limit = params.get("time_limit", 20)  # default 30 seconds

                if not cmd:
                    state["error"] = "run_command: missing 'command' parameter"
                    return state

                result = run_command(cmd, cwd, str(time_limit))
                output = result["stdout"] + result["stderr"]

                state["runtime_context"].append(
                    f"[COMMAND]: {cmd}\n{output}"
                )
                state["last_output"] = output

                if result["exit_code"] != 0:
                    state["error"] = output
                
                print("command_output: ", output)
                return state

            except Exception as e:
                state["error"] = f"Failed to run_command: {str(e)}"
                return state

        # Unknown tool
        state["error"] = f"Unknown tool: {tool_name}"
        return state

    # -------------------------
    # FALLBACK: Handle legacy string format
    # -------------------------
    if isinstance(step, str):
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
                full_path = os.path.join(cwd, path)
                print("writing in file : ", full_path)
                write_file(os.path.join(cwd, path), content)
                return state
            except Exception as e:
                state["error"] = f"Failed to write {step}: {str(e)}"
                return state

        # -------------------------
        # PATCH
        # -------------------------
        if step.startswith("patch::"):
            try:
                _, path, unified_diff = step.split("::", 2)
                full_path = os.path.join(cwd, path)
                print("patching in file : ", path)
                updated_content = str_replace(full_path, unified_diff)
                print("saved")
                return state
            except Exception as e:
                state["error"] = f"Failed to patch {step}: {str(e)}"
                return state

        # -------------------------
        # RUN
        # -------------------------
        if step.startswith("run::"):
            try:
                _, cmd, time = step.split("::", 2)
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
            except Exception as e:
                state["error"] = f"Failed to run {step}: {str(e)}"
                return state

        # -------------------------
        # UNKNOWN STEP
        # -------------------------
        state["error"] = f"Unknown command: {step}"
        return state

    # No step to execute
    state["error"] = f"Invalid step format: {type(step)}"
    return state