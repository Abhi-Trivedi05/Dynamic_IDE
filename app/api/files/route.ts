import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs-extra";
import path from "path";
import os from "os";

const getBaseDir = (email: string) => path.normalize(path.join(os.homedir(), "ide-repos", email));

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get("path");
        if (!filePath) return NextResponse.json({ error: "No path provided" }, { status: 400 });

        const userReposBase = getBaseDir(session.user.email);
        const normalizedPath = path.normalize(filePath);

        if (!normalizedPath.startsWith(userReposBase)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const stats = await fs.stat(normalizedPath);
        if (stats.isDirectory()) {
            const items = await fs.readdir(normalizedPath, { withFileTypes: true });
            const fileTree = items.map(item => ({
                name: item.name,
                isDirectory: item.isDirectory(),
                path: path.join(normalizedPath, item.name)
            }));
            return NextResponse.json(fileTree);
        } else {
            const content = await fs.readFile(normalizedPath, "utf-8");
            return new Response(content, { headers: { "Content-Type": "text/plain" } });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get("path");
        const { content, name, type } = await req.json();
        if (!filePath) return NextResponse.json({ error: "No path provided" }, { status: 400 });

        const userReposBase = getBaseDir(session.user.email);
        const normalizedPath = path.normalize(filePath);

        if (!normalizedPath.startsWith(userReposBase)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        if (name && type) {
            const newPath = path.join(normalizedPath, name);
            if (type === "folder") await fs.ensureDir(newPath);
            else await fs.ensureFile(newPath);
            return NextResponse.json({ success: true, path: newPath });
        } else {
            await fs.writeFile(normalizedPath, content);
            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { sourcePath, targetPath } = await req.json();
        if (!sourcePath || !targetPath) return NextResponse.json({ error: "Source and target paths are required" }, { status: 400 });

        const userReposBase = getBaseDir(session.user.email);
        const normalizedSource = path.normalize(sourcePath);
        const normalizedTarget = path.normalize(targetPath);

        console.log(`[MOVE-API] ${normalizedSource} -> ${normalizedTarget}`);

        if (!normalizedSource.startsWith(userReposBase) || !normalizedTarget.startsWith(userReposBase)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        if (!fs.existsSync(normalizedSource)) return NextResponse.json({ error: "Source item does not exist" }, { status: 404 });
        if (!fs.existsSync(normalizedTarget)) return NextResponse.json({ error: "Target directory does not exist" }, { status: 404 });

        const targetStats = await fs.stat(normalizedTarget);
        let finalTargetPath = normalizedTarget;

        if (targetStats.isDirectory()) {
            finalTargetPath = path.join(normalizedTarget, path.basename(normalizedSource));
        }

        // Check for self-move or move to child
        if (finalTargetPath === normalizedSource) return NextResponse.json({ error: "Cannot move to existing location" }, { status: 400 });

        const sourceStats = await fs.stat(normalizedSource);
        if (sourceStats.isDirectory()) {
            // Cannot move a folder into itself (e.g. move Folder1 into Folder1/Sub)
            // We append a path separator to ensure we don't match partial folder names
            const sourcePrefix = normalizedSource.endsWith(path.sep) ? normalizedSource : normalizedSource + path.sep;
            if (finalTargetPath.startsWith(sourcePrefix)) {
                return NextResponse.json({ error: "Cannot move a folder into its own subfolder" }, { status: 400 });
            }
        }

        await fs.move(normalizedSource, finalTargetPath, { overwrite: false });
        console.log(`[MOVE-API] SUCCESS: moved to ${finalTargetPath}`);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(`[MOVE-API] ERROR: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get("path");
        if (!filePath) return NextResponse.json({ error: "No path provided" }, { status: 400 });

        const userReposBase = getBaseDir(session.user.email);
        const normalizedPath = path.normalize(filePath);

        if (!normalizedPath.startsWith(userReposBase)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        if (!fs.existsSync(normalizedPath)) {
            return NextResponse.json({ error: "Item does not exist" }, { status: 404 });
        }

        // Do not allow deleting the root repos folder for security
        if (normalizedPath === userReposBase) {
            return NextResponse.json({ error: "Cannot delete the root directory" }, { status: 400 });
        }

        await fs.remove(normalizedPath);
        console.log(`[DELETE-API] SUCCESS: removed ${normalizedPath}`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(`[DELETE-API] ERROR: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
