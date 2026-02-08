import json
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os
import re
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

API_KEY = os.getenv("API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# llm = ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=API_KEY)
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GEMINI_API_KEY)


def extract_json(text: str) -> dict:
    """
    Extracts the first JSON object found in a string.
    Handles markdown code fences and extra text.
    """
    # Remove ```json and ``` fences
    cleaned = re.sub(r"```json|```", "", text, flags=re.IGNORECASE).strip()

    # Extract first {...} block
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in LLM output:\n{cleaned}")

    return json.loads(match.group(0))


def IntentNode(state):
    prompt = f"""
User goal:
{state['goal']}

Return a JSON object ONLY with this schema, No explanations, no extra text, one json object only:
{{ "intent": "...", "type": "create | debug | improve" }}
"""
    res = llm.invoke(prompt)
    try:
        intent = extract_json(res.content)
        print(intent)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON from LLM: {res.content}") from e
    
    return {**state, "intent": intent}