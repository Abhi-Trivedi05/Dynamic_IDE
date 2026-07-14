from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import sys
import os

# Ensure the debugger module is in the path
sys.path.append(os.path.join(os.path.dirname(__file__), "debugger"))

from debugger.agent import agent
from debugger.state import AgentState

app = FastAPI(title="Dynamic IDE Backend API")

# Enable CORS so a remote hosted web UI can query localhost agent
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins; in production, you can restrict this to your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentRequest(BaseModel):
    goal: str
    cwd: str

class AgentResponse(BaseModel):
    goal: str
    ans: str
    runtime_context: List[str]
    execution_history: List[str]
    done: bool
    error: Optional[str] = None

@app.post("/invoke", response_model=AgentResponse)
async def invoke_agent(req: AgentRequest):
    if not os.path.isdir(req.cwd):
        raise HTTPException(status_code=400, detail="Invalid workspace directory (cwd)")

    # Initialize the state
    initial_state: AgentState = {
        "goal": req.goal,
        "cwd": req.cwd,
        "files": [],
        "file_context": {},
        "step_index": 0,
        "ans": "",
        "last_output": "",
        "error": None,
        "tasks": [],
        "plans": None,
        "current_step": None,
        "runtime_context": [],
        "execution_history": [],
        "done": False
    }

    config = {"recursion_limit": 50, "debug": True}

    try:
        # Run the concurrent graph
        final_state = agent.invoke(initial_state, config=config)
        
        return AgentResponse(
            goal=final_state.get("goal", req.goal),
            ans=final_state.get("ans", ""),
            runtime_context=final_state.get("runtime_context", []),
            execution_history=final_state.get("execution_history", []),
            done=final_state.get("done", False),
            error=final_state.get("error")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Make sure to install fastapi and uvicorn: pip install fastapi uvicorn
    uvicorn.run("api_gateway:app", host="0.0.0.0", port=8000, reload=True)
