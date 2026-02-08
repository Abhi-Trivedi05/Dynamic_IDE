import os
from tools import list_files

def ObserveNode(state):
    state["files"] = list_files(state['cwd'])
    
    return state