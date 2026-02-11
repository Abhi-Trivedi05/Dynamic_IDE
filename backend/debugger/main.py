import os
from agent import agent
from state import AgentState

if __name__ == "__main__":
    goal = input("What should I do in this project? ")

# Assuming the AgentState TypedDict is already defined as you provided
    state: AgentState = {
        "goal": goal,
        "ans": "",
        "cwd": r"C:\Users\Apurav\Downloads\Nao_medical",  # Directory path as string
        "files": [],  # List of files to be processed
        "file_context": {},  # Empty dictionary for file contexts
        "step_index": 0,  # Index for the next step
        "last_output": "",  # The last output from execution
        "error": None,  # If there’s an error, otherwise None
        "plans": None,  # Plans are initially None, could be a list of steps if available
        "current_step": None,  # No current step at the beginning
        "runtime_context": [],  # List to store logs, errors, outputs
        "execution_history": [],  # History of steps executed
        "done": False  # Task is not done initially
    }

    config = {
        "recursive_limit": 100,  # Limit for recursive operations, if applicable
        "debug": True  # Enable debugging for the agent
    }

    # Call the agent with the state and configuration
    response = agent.invoke(state, config=config)

    # Assuming 'response' is the result from invoking the agent, you can print it to see the output
    print(response)
