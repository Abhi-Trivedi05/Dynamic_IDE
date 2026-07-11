import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { messages, cwd } = await req.json();

        if (!cwd) {
            return NextResponse.json({ error: "No workspace directory (cwd) provided" }, { status: 400 });
        }

        // The FastAPI agent expects a single "goal". We can combine the chat history 
        // to give it context, but emphasize the last user message.
        const lastUserMessage = messages[messages.length - 1]?.content || "";
        
        const goal = `Chat History:\n${messages.map((m: any) => `[${m.role}]: ${m.content}`).join('\n')}\n\nTask:\n${lastUserMessage}`;

        const backendUrl = process.env.AGENT_BACKEND_URL || "http://127.0.0.1:8000";

        const response = await fetch(`${backendUrl}/invoke`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                goal: goal,
                cwd: cwd
            }),
        });

        const resText = await response.text();
        let data: any = {};
        try {
            data = JSON.parse(resText);
        } catch (e) {
            // Not JSON
        }

        if (!response.ok) {
            let errorMessage = "Failed to fetch from Agent Backend";
            if (data.detail) {
                errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
            }
            return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        // Map the agent's response to the format expected by the frontend
        // Currently the frontend expects: { choices: [{ message: { content: "..." } }] }
        // We will enrich this content with the agent's runtime context so the user sees what it did.
        
        let agentOutput = "";
        
        if (data.runtime_context && data.runtime_context.length > 0) {
            agentOutput += "### Agent Logs:\n```\n";
            agentOutput += data.runtime_context.join("\n");
            agentOutput += "\n```\n\n";
        }
        
        if (data.ans) {
            agentOutput += `### Final Answer:\n${data.ans}`;
        } else if (data.error) {
            agentOutput += `### Error:\n${data.error}`;
        } else {
            agentOutput += "Agent completed tasks successfully.";
        }

        return NextResponse.json({
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: agentOutput
                    }
                }
            ]
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
