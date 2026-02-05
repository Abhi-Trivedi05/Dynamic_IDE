"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { FileCode, Folder, ChevronRight, Save, Play, Code2, FilePlus, FolderPlus, RefreshCcw, Search, Settings, UserCircle, Trash2, ArrowLeft, Sparkles, Send, X } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const Terminal = dynamic(() => import("@/components/Terminal"), { ssr: false });

interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
}

export default function IDEPage() {
    const { id } = useParams();
    const [repoPath, setRepoPath] = useState<string | null>(null);
    const [repoName, setRepoName] = useState("");
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [treeData, setTreeData] = useState<Record<string, FileNode[]>>({});
    const [creating, setCreating] = useState<{ type: "file" | "folder"; parentPath: string } | null>(null);
    const [newItemName, setNewItemName] = useState("");
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [isResizing, setIsResizing] = useState(false);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [aiMessages, setAiMessages] = useState<{ role: string, content: string }[]>([]);
    const [aiInput, setAiInput] = useState("");
    const [isAILoading, setIsAILoading] = useState(false);

    const router = useRouter();
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    useEffect(() => {
        if (status === "authenticated") {
            fetchRepoDetails();
        }
    }, [status, id]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            let newWidth = e.clientX - 48; // subtract activity bar width (w-12 = 48px)
            if (newWidth < 160) newWidth = 160;
            if (newWidth > 500) newWidth = 500;
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
        } else {
            document.body.style.cursor = "default";
            document.body.style.userSelect = "auto";
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing]);

    // Handle Save Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeFile, code]);

    const fetchRepoDetails = async () => {
        const res = await fetch("/api/repos");
        const data = await res.json();
        const repo = data.repos.find((r: any) => r._id === id);
        if (repo) {
            setRepoPath(repo.path);
            setRepoName(repo.name);
            fetchFiles(repo.path);
            setExpanded(new Set([repo.path]));
        }
    };

    const fetchFiles = async (path: string) => {
        const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            // Sort: Directories first, then alphabetical
            const sortedData = data.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
            });
            setTreeData(prev => ({ ...prev, [path]: sortedData }));
        }
    };

    const toggleFolder = async (path: string) => {
        const newExpanded = new Set(expanded);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
            if (!treeData[path]) {
                await fetchFiles(path);
            }
        }
        setExpanded(newExpanded);
    };

    const handleFileClick = async (file: FileNode) => {
        if (file.isDirectory) {
            toggleFolder(file.path);
        } else {
            const res = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`);
            const content = await res.text();
            setActiveFile(file.path);
            setCode(content);
        }
    };

    const handleCreate = async () => {
        if (!creating || !newItemName) return;

        const res = await fetch(`/api/files?path=${encodeURIComponent(creating.parentPath)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newItemName, type: creating.type }),
        });

        if (res.ok) {
            setCreating(null);
            setNewItemName("");
            fetchFiles(creating.parentPath);
            if (!expanded.has(creating.parentPath)) {
                toggleFolder(creating.parentPath);
            }
        }
    };

    const FileItem = ({ item, depth = 0 }: { item: FileNode; depth?: number }) => {
        const isExpanded = expanded.has(item.path);
        const children = treeData[item.path] || [];
        const isActive = activeFile === item.path;
        const [isOver, setIsOver] = useState(false);

        const handleDragStart = (e: React.DragEvent) => {
            e.stopPropagation();
            e.dataTransfer.setData("sourcePath", item.path);
            e.dataTransfer.effectAllowed = "move";
        };

        const handleDrop = async (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOver(false);
            const sourcePath = e.dataTransfer.getData("sourcePath");
            const targetPath = item.path;

            console.log(`[UI] Moving ${sourcePath} -> ${targetPath}`);

            if (sourcePath === targetPath || !item.isDirectory) return;

            const res = await fetch("/api/files", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sourcePath, targetPath }),
            });

            if (res.ok) {
                const lastSlash = Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\'));
                const sourceParent = sourcePath.substring(0, lastSlash === -1 ? 0 : lastSlash);

                if (sourceParent) await fetchFiles(sourceParent);
                else if (repoPath) await fetchFiles(repoPath);

                await fetchFiles(targetPath);

                if (activeFile === sourcePath) {
                    setActiveFile(null);
                    setCode("");
                }
            } else {
                const err = await res.json();
                console.error("[UI] Move failed:", err);
                alert(err.error || "Failed to move item");
            }
        };

        const handleDelete = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!window.confirm(`Are you sure you want to delete ${item.name}?`)) return;

            const res = await fetch(`/api/files?path=${encodeURIComponent(item.path)}`, {
                method: "DELETE",
            });

            if (res.ok) {
                const lastSlash = Math.max(item.path.lastIndexOf('/'), item.path.lastIndexOf('\\'));
                const parentPath = item.path.substring(0, lastSlash === -1 ? 0 : lastSlash);

                if (parentPath) await fetchFiles(parentPath);
                else if (repoPath) await fetchFiles(repoPath);

                if (activeFile === item.path) {
                    setActiveFile(null);
                    setCode("");
                }
            } else {
                const err = await res.json();
                alert(err.error || "Failed to delete item");
            }
        };

        return (
            <div>
                <div
                    draggable
                    onDragStart={handleDragStart}
                    onDragOver={(e) => {
                        if (item.isDirectory) {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOver(true);
                        }
                    }}
                    onDragLeave={(e) => {
                        e.stopPropagation();
                        setIsOver(false);
                    }}
                    onDrop={handleDrop}
                    onClick={() => handleFileClick(item)}
                    className={`flex items-center gap-2 py-1 px-2 cursor-pointer text-sm group transition-colors ${isActive ? "bg-blue-600/20 text-blue-400" :
                        isOver ? "bg-blue-500/30 text-blue-300" :
                            "hover:bg-gray-800/50 text-gray-400 hover:text-gray-200"
                        }`}
                    style={{ paddingLeft: `${depth * 12 + 12}px` }}
                >
                    {item.isDirectory ? (
                        <div className="flex items-center gap-1.5 flex-1 overflow-hidden relative">
                            <ChevronRight
                                size={14}
                                className={`text-gray-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            />
                            <Folder size={16} className={`${isExpanded ? "text-blue-400" : "text-gray-500"}`} />
                            <span className="truncate font-medium flex-1">{item.name}</span>

                            {/* Actions on Hover */}
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900/80 px-1 rounded-md ml-2 h-full items-center">
                                <FilePlus
                                    size={14}
                                    className="text-gray-400 hover:text-white transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCreating({ type: "file", parentPath: item.path });
                                        setNewItemName("");
                                    }}
                                />
                                <FolderPlus
                                    size={14}
                                    className="text-gray-400 hover:text-white transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCreating({ type: "folder", parentPath: item.path });
                                        setNewItemName("");
                                    }}
                                />
                                <Trash2
                                    size={14}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    onClick={handleDelete}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 flex-1 overflow-hidden pl-[18px]">
                            <FileCode size={16} className={`${isActive ? "text-blue-400" : "text-gray-500"}`} />
                            <span className="truncate flex-1">{item.name}</span>
                            <Trash2
                                size={14}
                                className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                onClick={handleDelete}
                            />
                        </div>
                    )}
                </div>

                {item.isDirectory && isExpanded && (
                    <div>
                        {/* Nested Creation Input */}
                        {creating?.parentPath === item.path && (
                            <div className="flex items-center gap-2 py-1 px-2" style={{ paddingLeft: `${(depth + 1) * 12 + 30}px` }}>
                                {creating.type === "file" ? <FileCode size={14} /> : <Folder size={14} />}
                                <input
                                    autoFocus
                                    className="bg-gray-900 border border-blue-500 rounded px-1 text-xs outline-none w-full"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    onBlur={() => setCreating(null)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleCreate();
                                        if (e.key === "Escape") setCreating(null);
                                    }}
                                />
                            </div>
                        )}
                        {children.map(child => (
                            <FileItem key={child.path} item={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const handleSave = async () => {
        if (!activeFile) return;
        const res = await fetch(`/api/files?path=${encodeURIComponent(activeFile)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: code }),
        });
        if (res.ok) {
            // Optional: Show a subtle toast
        }
    };

    const handleSendMessage = async () => {
        if (!aiInput.trim() || isAILoading) return;

        const userMessage = { role: "user", content: aiInput };
        const newMessages = [...aiMessages, userMessage];
        setAiMessages(newMessages);
        setAiInput("");
        setIsAILoading(true);

        try {
            // Add code context if a file is open
            const contextPrompt = activeFile
                ? `Current file: ${activeFile}\nContent:\n${code}\n\nUser Question: ${aiInput}`
                : aiInput;

            const res = await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        ...aiMessages,
                        { role: "user", content: contextPrompt }
                    ]
                }),
            });

            const data = await res.json();
            if (data.choices?.[0]?.message) {
                setAiMessages([...newMessages, data.choices[0].message]);
            } else {
                setAiMessages([...newMessages, { role: "assistant", content: "Error: " + (data.error || "Failed to get response") }]);
            }
        } catch (error: any) {
            setAiMessages([...newMessages, { role: "assistant", content: "Error: " + error.message }]);
        } finally {
            setIsAILoading(false);
        }
    };

    const getLanguage = (filepath: string | null) => {
        if (!filepath) return "javascript";
        const ext = filepath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case "ts":
            case "tsx": return "typescript";
            case "js":
            case "jsx": return "javascript";
            case "css": return "css";
            case "html": return "html";
            case "json": return "json";
            case "md": return "markdown";
            default: return "plaintext";
        }
    };

    if (status === "loading") {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading IDE...</div>;
    }

    if (!session) return null;

    return (
        <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans">
            {/* Activity Bar */}
            <div className="w-12 bg-gray-900/50 border-r border-gray-800 flex flex-col items-center py-4 gap-6">
                <div
                    className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer mb-2"
                    onClick={() => router.push('/dashboard')}
                    title="Back to Dashboard"
                >
                    <ArrowLeft size={24} />
                </div>
                <div className="p-2 text-white border-l-2 border-blue-500 cursor-pointer">
                    <Code2 size={24} />
                </div>
                <div className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer">
                    <Search size={24} />
                </div>
                <div
                    className={`p-2 transition-colors cursor-pointer ${isAIChatOpen ? "text-blue-500 border-l-2 border-blue-500" : "text-gray-500 hover:text-white"}`}
                    onClick={() => setIsAIChatOpen(!isAIChatOpen)}
                >
                    <Sparkles size={24} />
                </div>
                <div className="mt-auto flex flex-col gap-6 items-center pb-4">
                    <Settings className="text-gray-500 hover:text-white cursor-pointer" size={24} />
                    <UserCircle className="text-gray-500 hover:text-white cursor-pointer" size={24} />
                </div>
            </div>

            {/* Sidebar Explorer */}
            <div
                style={{ width: `${sidebarWidth}px` }}
                className="border-r border-gray-800 flex flex-col bg-gray-950 shrink-0"
            >
                <div className="h-9 px-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-800/50">
                    Explorer
                    <div className="flex gap-2">
                        <FilePlus
                            size={16}
                            className="hover:text-gray-200 cursor-pointer transition-colors"
                            onClick={() => {
                                setCreating({ type: "file", parentPath: repoPath! });
                                setNewItemName("");
                            }}
                        />
                        <FolderPlus
                            size={16}
                            className="hover:text-gray-200 cursor-pointer transition-colors"
                            onClick={() => {
                                setCreating({ type: "folder", parentPath: repoPath! });
                                setNewItemName("");
                            }}
                        />
                        <RefreshCcw
                            size={14}
                            className="hover:text-gray-200 cursor-pointer transition-colors"
                            onClick={() => repoPath && fetchFiles(repoPath)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="px-4 py-2 flex items-center gap-2 text-xs font-bold text-gray-300 bg-gray-900/30">
                        <ChevronRight size={14} className="rotate-90 text-gray-500" />
                        {repoName || "Project"}
                    </div>
                    <div className="pt-1">
                        {repoPath && treeData[repoPath]?.map((file) => (
                            <FileItem key={file.path} item={file} />
                        ))}

                        {/* Root Creation Input */}
                        {creating?.parentPath === repoPath && (
                            <div className="flex items-center gap-2 py-1 px-4 ml-4">
                                {creating.type === "file" ? <FileCode size={14} /> : <Folder size={14} />}
                                <input
                                    autoFocus
                                    className="bg-gray-900 border border-blue-500 rounded px-1 text-xs outline-none w-full"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    onBlur={() => setCreating(null)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleCreate();
                                        if (e.key === "Escape") setCreating(null);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Resizer Handle */}
            <div
                onMouseDown={() => setIsResizing(true)}
                className={`w-1 cursor-col-resize transition-colors z-20 hover:bg-blue-500/50 ${isResizing ? "bg-blue-500/50" : "bg-transparent"}`}
            />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-black">
                {/* Tabs / Header */}
                <div className="h-9 flex items-center bg-gray-950 border-b border-gray-800">
                    {activeFile && (
                        <div className="h-full bg-black border-r border-gray-800 border-t-2 border-t-blue-500 px-4 flex items-center gap-2 text-xs">
                            <FileCode size={14} className="text-blue-400" />
                            {activeFile.split(/[\\/]/).pop()}
                            <div className="ml-4 w-2 h-2 rounded-full bg-blue-500"></div>
                        </div>
                    )}
                    <div className="ml-auto flex gap-4 px-4">
                        <button
                            onClick={handleSave}
                            disabled={!activeFile}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                            <Save size={14} /> Save
                        </button>
                    </div>
                </div>

                {/* Editor Content */}
                <div className="flex-1 flex flex-col relative">
                    <div className="flex-1">
                        {activeFile ? (
                            <Editor
                                height="100%"
                                theme="vs-dark"
                                language={getLanguage(activeFile)}
                                value={code}
                                onChange={(value) => setCode(value || "")}
                                options={{
                                    fontSize: 14,
                                    minimap: { enabled: true },
                                    fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                                    fontLigatures: true,
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    padding: { top: 10, bottom: 10 },
                                    cursorBlinking: "smooth",
                                    smoothScrolling: true,
                                    lineNumbers: "on",
                                    renderLineHighlight: "all",
                                }}
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 gap-4">
                                <div className="p-4 rounded-full bg-gray-900/50">
                                    <Code2 size={64} className="opacity-20" />
                                </div>
                                <h2 className="text-xl font-medium opacity-50">Welcome to {repoName}</h2>
                                <p className="text-sm opacity-30">Select or create a file to get started</p>
                            </div>
                        )}
                    </div>

                    {/* Terminal Section (Collapsible in real apps, simplified here) */}
                    <div className="h-64 border-t border-gray-800 bg-gray-950">
                        <div className="h-8 border-b border-gray-800 px-4 flex items-center gap-6 text-[10px] uppercase font-bold text-gray-500">
                            <span className="text-white border-b border-white py-1 cursor-pointer">Terminal</span>
                            <span className="hover:text-white cursor-pointer">Debug Console</span>
                            <span className="hover:text-white cursor-pointer">Output</span>
                        </div>
                        <div className="flex-1 h-[calc(100%-2rem)]">
                            {repoPath ? (
                                <Terminal workingDirectory={repoPath} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-600 text-xs">
                                    Initializing terminal...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Chat Panel */}
            {isAIChatOpen && (
                <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col shrink-0">
                    <div className="h-9 px-4 flex items-center justify-between border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                        AI Assistant
                        <X
                            size={14}
                            className="cursor-pointer hover:text-white"
                            onClick={() => setIsAIChatOpen(false)}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {aiMessages.length === 0 && (
                            <div className="text-center text-gray-600 mt-10">
                                <Sparkles size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Ask me anything about your project!</p>
                            </div>
                        )}
                        {aiMessages.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[90%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isAILoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-800 text-gray-400 rounded-lg p-3 text-sm animate-pulse">
                                    AI is thinking...
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-gray-800">
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                                placeholder="Ask AI..."
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isAILoading}
                                className="p-2 bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
