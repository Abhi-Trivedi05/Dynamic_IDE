from langchain_groq import ChatGroq
import json
from dotenv import load_dotenv
import os
from typing import Dict
import re
from json_repair import repair_json
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()
# API_KEY = os.getenv("API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# llm = ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=API_KEY)
llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", google_api_key=GEMINI_API_KEY)

def extract_json(text: str):
    """
    Extracts and repairs JSON safely from LLM output.
    Handles:
    - Markdown fences
    - Broken escaping
    - Trailing quotes
    - Minor JSON corruption
    """

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

    # Try direct load first
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Extract first valid JSON object using regex
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found:\n{text}")

    raw_json = match.group(0)

    # Attempt repair
    try:
        fixed_json = repair_json(raw_json)
        return json.loads(fixed_json)
    except Exception as e:
        raise ValueError(
            f"Failed to parse JSON.\nExtracted:\n{raw_json}\n\nOriginal:\n{text}"
        ) from e

def PlanNode(state):
    prompt = f"""
You are an autonomous software engineer agent responsible for selecting exactly one tool invocation to make progress toward the GOAL.

Provide as output ONLY a single JSON object (no surrounding text, no markdown) that matches one of the allowed tool-call shapes below.

CONTEXT:
GOAL:
{state['goal']}

CURRENT FILES:
{state['files']}

EXECUTION HISTORY:
{state['execution_history']}

FILES READ (with content):
{state['file_context']}

RUNTIME OUTPUT / ERRORS:
{state['runtime_context']}

LAST ERROR (if any):
{state['error']}

ALLOWED TOOLS (choose EXACTLY ONE):

1) read_file
{{
    "name": "read_file",
    "description": "Read entire contents of a file",
    "parameters": {{
        "path": "string"
    }}
}}

2) str_replace
{{
    "name": "str_replace",
    "description": "Replace a unique string in a file. old_str must appear EXACTLY ONCE. Include enough surrounding context (3-5 lines) to be unique. Fails if 0 or 2+ matches found.",
    "parameters": {{
        "path": "string",
        "old_str": "string — must be unique in the file",
        "new_str": "string — replacement content"
    }}
}}

3) write_file
{{
    "name": "write_file",
    "description": "Create a new file or fully overwrite. Use only for new files or when str_replace is impossible.",
    "parameters": {{
        "path": "string",
        "content": "string"
    }}
}}

4) run_command
{{
    "name": "run_command",
    "description": "Run a shell command",
    "parameters": {{
        "command": "string"
    }}
}}

If the GOAL is already satisfied, return a single JSON object with "name": "done" and an empty "parameters" object.

STRICT OUTPUT RULES:
- Output exactly one JSON object matching one of the allowed tool shapes above (or the done object).
- Do not include any additional keys beyond "name" and "parameters" (an optional "ans" string is allowed).
- Do not wrap the object in arrays, lists, or markdown fences.
- Do not provide human explanations or step-by-step reasoning.

EXAMPLE (reading a file):
{{
    "name": "read_file",
    "parameters": {{"path": "backend/debugger/nodes/plan.py"}}
}}

EXAMPLE (done):
{{
    "name": "done",
    "parameters": {{}}
}}
"""
    
    res = llm.invoke(prompt)
    try:
        decision = extract_json(res.content)
    except Exception as e:
        raise ValueError(f"Invalid JSON from LLM: {res.content}") from e

    # If the model returned a list, take the first object
    if isinstance(decision, list) and len(decision) > 0:
        decision = decision[0]

    if not isinstance(decision, dict) or "name" not in decision or "parameters" not in decision:
        raise ValueError(f"LLM returned an object that does not match required tool-call shape:\n{decision}")

    print(decision)

    name = decision["name"]
    params = decision.get("parameters", {})
    ans = decision.get("ans") if isinstance(decision.get("ans"), str) else None

    if name == "done":
        return {**state, "done": True, "ans": ans, "current_step": None}

    # Store the chosen tool call object in current_step for downstream executor
    return {**state, "current_step": {"name": name, "parameters": params}, "ans": ans, "error": None}