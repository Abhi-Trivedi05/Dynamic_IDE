import os
from agent import agent

if __name__ == "__main__":
    goal = input("What should I do in this project? ")

    agent.invoke({
        "goal": goal,
        "cwd": r"C:\Users\Apurav\Downloads\Nao_medical",
        "files": [],
        "last_output": "",
        "error": None,
        "plan": None,
        "current_step": None,
        "just_read": False
    }, config={
        "recursive_limit": 100,
        "debug": True
    })