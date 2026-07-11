from typing import Dict, TypedDict, List, Optional, Annotated, Any
import operator

def merge_dicts(d1: dict, d2: dict) -> dict:
    # Reducer for dictionary state updates
    merged = d1.copy() if d1 else {}
    if d2:
        merged.update(d2)
    return merged

class AgentState(TypedDict):
    goal: str
    cwd: str

    files: List[str]
    file_context: Annotated[Dict[str, str], merge_dicts]
    step_index: int
    ans: str

    last_output: str
    error: Optional[str]
    
    # Store dynamic assignments for sub-agents
    tasks: List[Dict[str, Any]]

    plans: Optional[List[str]]
    current_step: Optional[str]
    
    # Use reducers for parallel appending
    runtime_context: Annotated[list[str], operator.add]
    execution_history: Annotated[list[str], operator.add]   

    done: bool