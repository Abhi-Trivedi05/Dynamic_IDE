# Current Backend Architecture

## Overview
The backend currently implements a single-agent autonomous debugger/developer built using `langgraph`. It operates based on a state machine executing a sequential loop to fulfill a user-provided goal.

## System Components

### 1. State Management (`debugger/state.py`)
Uses a `TypedDict` to track the agent's progress:
- **goal**: The objective given by the user.
- **cwd**: The workspace directory.
- **files**: List of files discovered in the workspace.
- **file_context**: Dictionary of read files and their contents.
- **execution_history**: Logs of the tool steps executed.
- **runtime_context**: Accumulated logs and command outputs.
- **current_step**: The pending tool call.
- **done**: Boolean flag to track task completion.

### 2. Tools (`debugger/tools.py`)
A set of low-level utilities available to the agent:
- `list_files`: Scans directory recursively (ignoring `node_modules` and directories with >20 files)
- `read_file`: Reads target file contents.
- `write_file`: Overwrites or creates new files.
- `str_replace`: Replaces a targeted string sequence in a file.
- `run_command`: Executes a terminal command in a background thread with a timeout limit and captures `stdout`/`stderr`.

### 3. Execution Graph (`debugger/agent.py`)
The execution is modeled as a simple sequential `StateGraph`:
1. **`ObserveNode`**: Scans the `cwd` using `list_files` to populate available files in state.
2. **`PlanNode`**: Uses an LLM (Gemini `gemini-2.5-flash` or Groq `llama-3.3-70b`) to observe the context and pick *exactly one* tool to execute from `read_file`, `str_replace`, `write_file`, `run_command`, or returns `done`. Output is parsed as JSON safely.
3. **`ExecuteNode`**: Executes the single tool call chosen by `PlanNode`. Updates the `file_context`, `runtime_context`, or logs any errors.
   - *Edges*: Routes back to `PlanNode` if `done` is false, or `END` if true.

### 4. Entrypoint (`debugger/main.py`)
- Initializes graph state.
- Prompts user via terminal for goal.
- Invokes `agent.invoke()` with state and debug configs.
