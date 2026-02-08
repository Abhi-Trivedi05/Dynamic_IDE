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
graph.add_node("apply", ApplyNode)

graph.set_entry_point("intent")

graph.add_edge("intent", "observe")
graph.add_edge("observe", "plan")
graph.add_edge("plan", "execute")

graph.add_conditional_edges(
    "execute",
    lambda s: "plan" if s.get("error") or s.get("just_read") else "apply"
)

graph.add_conditional_edges(
    "apply",
    lambda s: "execute" if s.get("current_step") else END
)

agent = graph.compile()