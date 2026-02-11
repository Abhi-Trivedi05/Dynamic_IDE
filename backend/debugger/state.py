from typing import Dict, TypedDict, List, Optional

class AgentState(TypedDict):
    goal: str
    cwd: str

    files: List[str]
    file_context: Dict[str, str]
    step_index: int
    ans: str

    last_output: str
    error: Optional[str]

    plans: Optional[List[str]]
    current_step: Optional[str]
    runtime_context: list[str]       # logs, errors, outputs
    execution_history: list[str]   

    done: bool