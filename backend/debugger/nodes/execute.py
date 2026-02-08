from tools import write_file, run_command, read_file

def ExecuteNode(state):
    step = state["current_step"]
    cwd = state["cwd"]

    if not step:
        return state

    if step.startswith("write"):
        _, path, content = step.split("::", 2)
        write_file(f"{cwd}/{path}", content)
        return {**state, "just_read": True}

    if step.startswith("run"):
        cmd = step.replace("run", "", 1).strip()
        result = run_command(cmd, cwd)
        output = result["stdout"] + result["stderr"]

        if result["exit_code"] != 0:
            return {**state, "error": output, "last_output": output, "just_read": False}

        return {**state, "last_output": output, "just_read": True}

    if step.startswith("read") or step.startswith("open"):
        # print("reading : ")
        try:
            _, path = step.split("::", 1)
            # print(path)
            content = read_file(f"{cwd}/{path}")
            return {**state, "last_output": content, "just_read": True}
        
        except Exception as e:
            return {
                **state,
                "error": e,
                "just_read": True
            }

    return {
        **state,
        "error": f"unknown command {state['current_step']}"
    }