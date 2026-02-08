from typing import Dict, TypedDict, List, Optional

class AgentState(TypedDict):
    goal: str
    cwd: str

    files: List[str]
    last_output: str
    error: Optional[str]

    plans: Optional[List[str]]
    current_step: Optional[str]

    just_read: bool