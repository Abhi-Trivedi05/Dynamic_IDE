def ApplyNode(state):
    plan = state['plans']

    if plan:
        plan.pop(0)
    
    return {
        **state,
        "plans": plan,
        "current_step": plan[0] if plan else None
    }