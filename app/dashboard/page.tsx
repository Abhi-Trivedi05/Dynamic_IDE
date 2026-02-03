"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Folder, Plus, Code2, LogOut, Trash2 } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

interface Repo {
    _id: string;
    name: string;
    path: string;
}

export default function Dashboard() {
    const [repos, setRepos] = useState<Repo[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [repoName, setRepoName] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [repoToDelete, setRepoToDelete] = useState<Repo | null>(null);
    const router = useRouter();

    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    useEffect(() => {
        if (status === "authenticated") {
            fetchRepos();
        }
    }, [status]);

    if (status === "loading") {
        return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>;
    }

    if (!session) return null;

    const fetchRepos = async () => {
        const res = await fetch("/api/repos");
        const data = await res.json();
        if (data.repos) setRepos(data.repos);
    };

    const handleDelete = async () => {
        if (!repoToDelete) return;

        const res = await fetch(`/api/repos?id=${repoToDelete._id}`, {
            method: "DELETE",
        });

        if (res.ok) {
            setShowDeleteModal(false);
            setRepoToDelete(null);
            fetchRepos();
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch("/api/repos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: repoName }),
        });
        if (res.ok) {
            setRepoName("");
            setShowModal(false);
            fetchRepos();
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            <header className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/20 rounded-lg">
                        <Code2 size={24} className="text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                        Dashboard
                    </h1>
                </div>

                {/* Profile Section */}
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border border-gray-800 rounded-2xl shadow-sm hover:border-blue-500/50 transition-all group">
                    <div className="flex flex-col text-right">
                        <span className="text-sm font-bold text-white leading-none mb-1">{session?.user?.name || "User"}</span>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center justify-end gap-1 transition-colors cursor-pointer"
                        >
                            <LogOut size={12} />
                            Logout
                        </button>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center font-bold text-lg">
                        {session?.user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <button
                    onClick={() => setShowModal(true)}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-800 rounded-2xl hover:border-blue-500 hover:bg-blue-500/5 transition-all group h-48 cursor-pointer"
                >
                    <div className="p-4 bg-gray-900 rounded-full mb-4 group-hover:bg-blue-600 transition-all">
                        <Plus size={32} className="text-gray-400 group-hover:text-white" />
                    </div>
                    <span className="font-semibold text-gray-400 group-hover:text-blue-400">Create New Repo</span>
                </button>

                {repos.map((repo) => (
                    <div
                        key={repo._id}
                        className="p-6 bg-gray-900 border border-gray-800 rounded-2xl hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 cursor-pointer transition-all h-48 flex flex-col justify-between group relative"
                        onClick={() => router.push(`/ide/${repo._id}`)}
                    >
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-gray-950 w-fit rounded-xl group-hover:bg-purple-600/20 transition-all">
                                <Folder size={28} className="text-purple-500" />
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRepoToDelete(repo);
                                    setShowDeleteModal(true);
                                }}
                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold truncate">{repo.name}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Deletion Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-4">Delete Repository?</h2>
                        <p className="text-gray-400 mb-8">
                            Are you sure you want to delete <span className="text-white font-semibold">"{repoToDelete?.name}"</span>?
                            This action cannot be undone and will delete all files permanently.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setRepoToDelete(null);
                                }}
                                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Create New Repository</h2>
                        <form onSubmit={handleCreate}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Repository Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                    placeholder="my-awesome-project"
                                    value={repoName}
                                    onChange={(e) => setRepoName(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all cursor-pointer"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
