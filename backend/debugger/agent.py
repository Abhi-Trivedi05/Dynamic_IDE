from langgraph.graph import StateGraph, END
from state import AgentState

from nodes.intent import IntentNode
from nodes.plan import PlanNode
from nodes.execute import ExecuteNode
from nodes.observe import ObserveNode
from nodes.apply import ApplyNode

graph = StateGraph(AgentState)

graph.add_node("intent", IntentNode)
graph.add_node("plan", PlanNode)
graph.add_node("execute", ExecuteNode)
graph.add_node("observe", ObserveNode)
# graph.add_node("apply", ApplyNode)

graph.set_entry_point("observe")

# graph.add_edge("intent", "observe")
graph.add_edge("observe", "plan")
graph.add_edge("plan", "execute")

graph.add_conditional_edges(
    "execute",
    lambda s: END if s.get("done") else "plan"
)

agent = graph.compile()