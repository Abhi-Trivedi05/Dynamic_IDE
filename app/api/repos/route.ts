import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Repo from "@/models/Repo";
import path from "path";
import os from "os";
import fs from "fs-extra";

import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const repos = await Repo.find({ owner: session.user.email }).sort({ createdAt: -1 });
        return NextResponse.json({ repos });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const { name } = await req.json();

        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const baseRepoPath = path.join(os.homedir(), "ide-repos", session.user.email);
        const repoPath = path.join(baseRepoPath, name);

        await fs.ensureDir(repoPath);

        const newRepo = await Repo.create({
            name,
            path: repoPath,
            owner: session.user.email
        });

        return NextResponse.json(newRepo);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        await connectDB();
        const repo = await Repo.findOne({ _id: id, owner: session.user.email });

        if (!repo) {
            return NextResponse.json({ error: "Repository not found" }, { status: 404 });
        }

        // 1. Delete physical directory
        if (repo.path && fs.existsSync(repo.path)) {
            await fs.remove(repo.path);
        }

        // 2. Delete from database
        await Repo.findByIdAndDelete(id);

        return NextResponse.json({ message: "Repository deleted successfully" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
