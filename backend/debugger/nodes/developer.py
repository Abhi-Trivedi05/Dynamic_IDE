from langchain_google_genai import ChatGoogleGenerativeAI
import json
import os
from .supervisor import extract_json
from tools import read_file, str_replace, write_file
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", google_api_key=GEMINI_API_KEY)

def DeveloperNode(state):
    print("\n--- DEVELOPER AGENT RUNNING ---")
    # This worker reads, patches, and writes files based on instruction in state['goal']
    instruction = state['goal']
    cwd = state['cwd']

    file_context = dict(state.get('file_context', {}))
    execution_history = []
    logs = []

    for step in range(10):
        prompt = f"""
You are the Developer Agent. Your task:
{instruction}

You have access to file modification tools. Output exactly one JSON object matching:
1) read_file: {{"name": "read_file", "parameters": {{"path": "string"}}}}
2) str_replace: {{"name": "str_replace", "parameters": {{"path": "string", "old_str": "string", "new_str": "string"}}}}
3) write_file: {{"name": "write_file", "parameters": {{"path": "string", "content": "string"}}}}
4) done: {{"name": "done", "parameters": {{}}}}

FILES READ (with content):
{json.dumps(file_context, indent=2)}

CURRENT SUBTASK STEP: {step + 1}
Output the JSON only. No explanations.
"""
        res = llm.invoke(prompt)
        print(f"Developer Step {step + 1} Result:", res)
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
            logs.append(f"[ERROR] Developer validation failed: {str(e)}")
            break

        tool_name = decision.get("name")
        params = decision.get("parameters", {})
        execution_history.append(f"developer: {tool_name}")

        if tool_name == "done":
            logs.append("[DEV] Finished subtask.")
            break

        elif tool_name == "read_file":
            try:
                path = params["path"]
                full_path = os.path.join(cwd, path)
                content = read_file(full_path)
                file_context[path] = content
                logs.append(f"[READ] {path}")
            except Exception as e:
                logs.append(f"[ERROR] read_file failed: {str(e)}")

        elif tool_name == "str_replace":
            try:
                path = params["path"]
                full_path = os.path.join(cwd, path)
                result = str_replace(full_path, params["old_str"], params["new_str"])
                if not result.startswith("ERROR"):
                    content = read_file(full_path)
                    file_context[path] = content
                logs.append(f"[PATCH] {path} -> {result}")
            except Exception as e:
                logs.append(f"[ERROR] patch failed: {str(e)}")

        elif tool_name == "write_file":
            try:
                path = params["path"]
                full_path = os.path.join(cwd, path)
                write_file(full_path, params["content"])
                file_context[path] = params["content"]
                logs.append(f"[WRITE] {path}")
            except Exception as e:
                logs.append(f"[ERROR] write_file failed: {str(e)}")
        
        else:
            logs.append(f"[ERROR] Unknown tool: {tool_name}")
            break

    return {
        "execution_history": execution_history,
        "runtime_context": logs,
        "file_context": file_context
    }

