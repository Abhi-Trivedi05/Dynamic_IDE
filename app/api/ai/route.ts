import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const apiKey = process.env.XAI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "XAI_API_KEY is not configured" }, { status: 500 });
        }

        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "grok-beta", // or grok-2 if available
                messages: [
                    {
                        role: "system",
                        content: "You are an AI assistant integrated into a web-based IDE. Help the user with code, explaining files, and general questions. Be concise and professional."
                    },
                    ...messages
                ],
                stream: false, // Keeping it simple for now, can add streaming later
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
            let errorMessage = "Failed to fetch from xAI";
            if (data.error) {
                if (typeof data.error === 'string') errorMessage = data.error;
                else if (data.error.message) errorMessage = data.error.message;
            } else if (data.message) {
                errorMessage = data.message;
            }

            // Check for specific xAI "credit" error in the body
            if (resText.includes("credits") || resText.includes("balance")) {
                errorMessage = "xAI Error: Your account has no credits. Please visit https://console.x.ai to add credits.";
            }

            return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
