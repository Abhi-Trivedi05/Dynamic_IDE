from langgraph.graph import StateGraph, END
from state import AgentState

from nodes.observe import ObserveNode
from nodes.supervisor import SupervisorNode, supervisor_router
from nodes.developer import DeveloperNode
from nodes.terminal import TerminalNode

# Build the Graph
graph = StateGraph(AgentState)

graph.add_node("observe", ObserveNode)
graph.add_node("supervisor", SupervisorNode)
graph.add_node("developer_agent", DeveloperNode)
graph.add_node("terminal_agent", TerminalNode)

# Entry point sets up the workspace context
graph.set_entry_point("observe")

graph.add_edge("observe", "supervisor")

# Supervisor dictates the flow using conditional edges mapping via Send requests
graph.add_conditional_edges(
    "supervisor",
    supervisor_router,
    # mapping of possible router outputs
    {
        "developer_agent": "developer_agent",
        "terminal_agent": "terminal_agent",
        "supervisor": "supervisor",
        "__end__": END
    }
)

# After a worker completes its task, loop back to the supervisor
graph.add_edge("developer_agent", "supervisor")
graph.add_edge("terminal_agent", "supervisor")

# Compile the multi-agent concurrent graph
agent = graph.compile()