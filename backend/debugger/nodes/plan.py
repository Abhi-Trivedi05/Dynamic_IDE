from langchain_groq import ChatGroq
import json
from dotenv import load_dotenv
import os
import re
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()
# API_KEY = os.getenv("API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# llm = ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=API_KEY)
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY)

def extract_json_list(text: str) -> list:
    """
    Safely extracts the first valid JSON array from text.
    Handles markdown, prose, and partial outputs.
    """

    # Remove markdown fences
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).strip()

    # Find the FIRST '[' and LAST ']'
    start = cleaned.find("[")
    end = cleaned.rfind("]")

    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"No JSON array found in LLM output:\n{text}")

    json_str = cleaned[start : end + 1]

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Failed to parse JSON array.\nExtracted:\n{json_str}\n\nOriginal:\n{text}"
        ) from e
    

def PlanNode(state):
    prompt = f"""
You are an autonomous software engineer.

Your task is to output ONLY a JSON array.
No explanations.
No markdown.
No text before or after.

Each item MUST be a string describing ONE concrete action
1) Read a file:
   "read::relative/path/to/file"

2) Write or update a file:
   "write::relative/path/to/file::FULL_FILE_CONTENT"

3) Run a command:
   "run <command>"

Goal:
{state['goal']}

Files:
{state['files']}

Last output:
{state['last_output']}

Error:
{state['error']}

OUTPUT FORMAT (STRICT):
[
  "step 1",
  "step 2",
  "step 3"
]
"""
    # print(prompt)
    res = llm.invoke(prompt)
    try:
        plan = extract_json_list(res.content)
        print(plan)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON from LLM: {res.content}") from e
    return {
        **state,
        "plans": plan,
        "current_step": plan[0] if plan else None,
        "error": None
    }