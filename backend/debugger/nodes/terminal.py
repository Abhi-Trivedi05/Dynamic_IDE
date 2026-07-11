from langchain_google_genai import ChatGoogleGenerativeAI
import json
from .supervisor import extract_json
from tools import run_command
import os
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", google_api_key=GEMINI_API_KEY)

def TerminalNode(state):
    print("\n--- TERMINAL AGENT RUNNING ---")
    # This worker runs terminal commands based on instruction in state['goal']
    instruction = state['goal']
    cwd = state['cwd']

    prompt = f"""
You are the Terminal Agent. Your task:
{instruction}

You have access to terminal commands. Output exactly one JSON object matching:
1) run_command: {{"name": "run_command", "parameters": {{"command": "string", "time_limit": 20}}}}
2) done: {{"name": "done", "parameters": {{}}}}

Output the JSON only. No explanations.
"""
    res = llm.invoke(prompt)
    try:
        content = res.content
        if isinstance(content, list) and len(content) > 0 and isinstance(content[0], dict):
            content = content[0].get("text", str(content))
        elif isinstance(content, str) and content.strip().startswith("[{'type':"):
            import ast
            try:
                parsed = ast.literal_eval(content.strip())
                content = parsed[0].get("text", content)
            except Exception:
                pass
        decision = extract_json(content)
        if isinstance(decision, list):
            decision = decision[0]
    except Exception as e:
        return {"error": f"Terminal validation failed: {str(e)}"}

    tool_name = decision.get("name")
    params = decision.get("parameters", {})
    history = [f"terminal: {tool_name}"]
    logs = []

    if tool_name == "run_command":
        try:
            cmd = params["command"]
            time_limit = params.get("time_limit", 20)
            result = run_command(cmd, cwd, str(time_limit))
            output = result["stdout"] + result["stderr"]
            if len(output) > 2000:
                output = output[:1000] + "\n...[TRUNCATED]...\n" + output[-1000:]
            logs.append(f"[COMMAND] {cmd}\n{output}")
        except Exception as e:
            logs.append(f"[ERROR] run_command failed: {str(e)}")

    elif tool_name == "done":
        logs.append("[TERM] Finished subtask.")
        
    return {
        "execution_history": history,
        "runtime_context": logs
    }
