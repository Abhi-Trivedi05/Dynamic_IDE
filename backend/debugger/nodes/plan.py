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
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY)

def extract_json(text: str):
    """
    Extracts and repairs JSON safely from LLM output.
    Handles:
    - Markdown fences
    - Broken escaping
    - Trailing quotes
    - Minor JSON corruption
    """

    # Remove markdown fences
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).strip()

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
You are an autonomous software engineer agent.

You CONTROL execution flow and MAY provide user-facing information,
but you MUST choose EXACTLY ONE action per response.

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

DECISION RULES (CRITICAL):
- Choose ONLY ONE action: "next" OR "done"
- You are NOT allowed to choose multiple actions
- Do NOT update or modify the plan in this response
- Never explain your reasoning

ACTION DEFINITIONS:
1. "next"
   - Choose this if there is still work required to reach the GOAL
   - Provide exactly ONE executable STEP

2. "done"
   - Choose this ONLY if the GOAL is fully achieved
   - Do NOT provide any executable step

STEP FORMAT (ONLY if action = "next"):
- read::path
- write::path::content
- patch::path::unified_diff (in the unified_diff do not add the full path add only the file name)
- run::<command>::time_limit_in_seconds (e.g. run::ls -la::30) it will run the command in terminal for the specified time and after time is up it will terminate the command and return the output and error if any

ANSWER RULE:
- "ans" is OPTIONAL
- Use "ans" ONLY to give concise, helpful information requested by the user
- If no user-facing answer is needed, set "ans" to null

OUTPUT FORMAT (STRICT):
- Output ONLY valid JSON
- No markdown
- No extra text
- No explanations

JSON SCHEMA (MUST MATCH EXACTLY):

{{
  "action": "next | done",
  "step": "<step string if action = next, otherwise null>",
  "ans": "<string if needed, otherwise null>"
}}
"""
    
    res = llm.invoke(prompt)
    try:
        # print(res.content)
        decision = extract_json(res.content)
        print(decision)

        if decision["action"] == "done":
            return {**state, "done": True, "ans": decision.get("ans", ""), "current_step": None}

        # action == next
        return {
            **state,
            "current_step": decision["step"],
            "ans": decision.get("ans", ""),
            "error": None
        }
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON from LLM: {res.content}") from e