from langchain_google_genai import ChatGoogleGenerativeAI
import json
import re
from langgraph.constants import Send
import os
from dotenv import load_dotenv
from json_repair import repair_json

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", google_api_key=GEMINI_API_KEY)

def extract_json(text):
    if isinstance(text, list) and len(text) > 0 and isinstance(text[0], dict):
        text = text[0].get("text", str(text))
    elif isinstance(text, str) and text.strip().startswith("[{'type':"):
        import ast
        try:
            parsed = ast.literal_eval(text.strip())
            text = parsed[0].get("text", text)
        except Exception:
            pass
            
    cleaned = re.sub(r"```(?:json)?", "", str(text), flags=re.IGNORECASE).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found:\n{text}")
    raw_json = match.group(0)
    try:
        return json.loads(repair_json(raw_json))
    except Exception as e:
        raise ValueError(f"Failed to parse JSON.\nOriginal:\n{text}") from e

def SupervisorNode(state):
    print("\n--- SUPERVISOR RUNNING ---")
    prompt = f"""
You are the Supervisor Agent overseeing a software project. Your GOAL is:
{state['goal']}

You can dispatch tasks to specialized worker agents concurrently to achieve this goal efficiently.
Available workers:
1. "developer_agent": Reads files, writes files, or patches existing files.
2. "terminal_agent": Runs bash/powershell commands (e.g. tests, linting, git).

RUNTIME CONTEXT / RECENT OUTPUT:
{state.get('runtime_context', [])[-5:]}

FILE CONTEXT (with content):
{json.dumps(state.get('file_context', {}), indent=2)}

EXECUTION HISTORY:
{state.get('execution_history', [])[-5:]}

Based on the current state, decide what concurrent tasks are needed next.
If the GOAL is fully satisfied, return EXACTLY:
{{"done": true, "ans": "Optional final answer to user"}}

If more work is needed, return a list (in JSON format) of ONE OR MORE task objects. Each task object must be:
{{
  "worker": "developer_agent" | "terminal_agent",
  "instruction": "Detailed instruction for the given worker"
}}

Output ONLY valid JSON.
"""
    res = llm.invoke(prompt)
    print("\n--- RAW MODEL OUTPUT ---")
    print(res.content)
    print("------------------------\n")
    try:
        decision = extract_json(res.content)
    except Exception as e:
        # If parsing fails due to model error, push error to history and try again
        err_msg = f"[SUPERVISOR ERROR] Failed to parse JSON: {str(e)}. You MUST output only valid JSON."
        return {"error": str(e), "runtime_context": [err_msg], "tasks": []}

    if isinstance(decision, dict) and decision.get("done"):
        return {"done": True, "ans": decision.get("ans", "")}
    
    if isinstance(decision, dict) and "worker" in decision:
        decision = [decision] # wrap single dict in list

    if not isinstance(decision, list):
        err_msg = "[SUPERVISOR ERROR] Returned invalid format. Expected list of tasks."
        return {"error": err_msg, "runtime_context": [err_msg], "tasks": []}

    # Generate Send objects to route to workers concurrently
    requests = []
    for task in decision:
        worker_name = task.get("worker")
        if worker_name in ["developer_agent", "terminal_agent"]:
            # We send a sliced version of the state + the instruction
            local_state = {
                "goal": task.get("instruction", state['goal']),
                "cwd": state['cwd'],
                "file_context": state.get('file_context', {}),
                "runtime_context": state.get('runtime_context', []),
                "execution_history": state.get('execution_history', []),
            }
            requests.append(Send(worker_name, local_state))
    
    # We don't return standard state dictionary. Returning Send triggers parallel nodes.
    # We must return the raw requests list or a dict mapping edges, depending on langgraph version.
    # In LangGraph 0.1/0.2, conditional edges handling mapped arrays is standard. 
    # Let's save `tasks` in the state to be used by a routing function.
    return {"tasks": decision, "error": None}

def supervisor_router(state):
    # This evaluates the state to dispatch Send API
    tasks = state.get("tasks", [])
    
    if state.get("done"):
        return "__end__"
        
    requests = []
    for task in tasks:
        worker_name = task.get("worker")
        if worker_name in ["developer_agent", "terminal_agent"]:
            # We must map over the worker nodes
            requests.append(Send(worker_name, {
                "goal": task.get("instruction", ""), 
                "cwd": state["cwd"],
                "file_context": state.get("file_context"),
                "runtime_context": state.get("runtime_context", []),
                "execution_history": state.get("execution_history", [])
            }))
    
    return requests if requests else "supervisor" # loop back if no tasks (shouldn't happen)
