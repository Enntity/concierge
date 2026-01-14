"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ban, CheckCircle, Trash2, Loader2 } from "lucide-react";
import {
    AdminTableContainer,
    AdminTable,
    AdminTableHead,
    AdminTableBody,
    AdminTableHeaderCell,
    AdminTableRow,
    AdminTableCell,
    AdminTableEmpty,
    AdminPagination,
} from "../components/AdminTable";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UserManagementClient({
    initialUsers,
    currentUser,
    totalPages,
    currentPage,
    search: initialSearch,
}) {
    const [users, setUsers] = useState(initialUsers);
    const [search, setSearch] = useState(initialSearch || "");
    const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
    const [userToPurge, setUserToPurge] = useState(null);
    const [isPurging, setIsPurging] = useState(false);
    const [purgeResult, setPurgeResult] = useState(null); // { success: boolean, results?: object, error?: string }
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        setUsers(initialUsers);
    }, [initialUsers]);

    const handleRoleChange = async (userId, newRole) => {
        try {
            const response = await fetch(`/api/users/${userId}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });

            if (response.ok) {
                setUsers(
                    users.map((u) =>
                        u._id === userId ? { ...u, role: newRole } : u,
                    ),
                );
            }
        } catch (error) {
            console.error("Error updating user role:", error);
        }
    };

    const handleBlockToggle = async (userId, currentlyBlocked) => {
        try {
            const response = await fetch(`/api/users/${userId}/block`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blocked: !currentlyBlocked }),
            });

            if (response.ok) {
                setUsers(
                    users.map((u) =>
                        u._id === userId
                            ? { ...u, blocked: !currentlyBlocked }
                            : u,
                    ),
                );
            } else {
                const error = await response.json();
                alert(error.error || "Failed to update block status");
            }
        } catch (error) {
            console.error("Error updating user block status:", error);
            alert("Failed to update block status");
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        search ? params.set("search", search) : params.delete("search");
        params.set("page", "1");
        router.push(`/admin/users?${params.toString()}`);
    };

    const handlePurgeClick = (user) => {
        setUserToPurge(user);
        setPurgeResult(null);
        setPurgeDialogOpen(true);
    };

    const handlePurgeConfirm = async () => {
        if (!userToPurge) return;

        setIsPurging(true);
        try {
            const response = await fetch(
                `/api/admin/users/${userToPurge._id}/purge`,
                { method: "DELETE" },
            );

            if (response.ok) {
                const result = await response.json();
                setUsers(users.filter((u) => u._id !== userToPurge._id));
                setPurgeResult({ success: true, results: result.results });
            } else {
                const error = await response.json();
                setPurgeResult({ success: false, error: error.error || "Failed to purge user" });
            }
        } catch (error) {
            console.error("Error purging user:", error);
            setPurgeResult({ success: false, error: "Failed to purge user" });
        } finally {
            setIsPurging(false);
        }
    };

    const handlePurgeDialogClose = () => {
        setPurgeDialogOpen(false);
        setUserToPurge(null);
        setPurgeResult(null);
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or username..."
                    className="flex-grow"
                />
                <Button type="submit">Search</Button>
            </form>

            <AdminTableContainer>
                <AdminTable>
                    <AdminTableHead>
                        <tr>
                            <AdminTableHeaderCell>Name</AdminTableHeaderCell>
                            <AdminTableHeaderCell>
                                Username
                            </AdminTableHeaderCell>
                            <AdminTableHeaderCell>Role</AdminTableHeaderCell>
                            <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                            <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
                        </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                        {users.length === 0 ? (
                            <AdminTableEmpty
                                colSpan={5}
                                message="No users found"
                            />
                        ) : (
                            users.map((user) => (
                                <AdminTableRow key={user._id}>
                                    <AdminTableCell className="font-medium text-gray-900 dark:text-gray-100">
                                        {user.name}
                                    </AdminTableCell>
                                    <AdminTableCell className="text-gray-500 dark:text-gray-400">
                                        {user.username}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                                            {user.role || "user"}
                                        </span>
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        {user.blocked ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                Blocked
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                Active
                                            </span>
                                        )}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        <div className="flex gap-2">
                                            <Select
                                                value={user.role || "user"}
                                                onValueChange={(v) =>
                                                    handleRoleChange(
                                                        user._id,
                                                        v,
                                                    )
                                                }
                                                disabled={
                                                    user._id ===
                                                    currentUser?._id
                                                }
                                            >
                                                <SelectTrigger className="w-[120px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="user">
                                                        User
                                                    </SelectItem>
                                                    <SelectItem value="admin">
                                                        Admin
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                onClick={() =>
                                                    handleBlockToggle(
                                                        user._id,
                                                        user.blocked,
                                                    )
                                                }
                                                disabled={
                                                    user._id ===
                                                    currentUser?._id
                                                }
                                                variant={
                                                    user.blocked
                                                        ? "default"
                                                        : "destructive"
                                                }
                                                size="sm"
                                                className="flex items-center gap-2"
                                            >
                                                {user.blocked ? (
                                                    <>
                                                        <CheckCircle className="h-4 w-4" />
                                                        Unblock
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ban className="h-4 w-4" />
                                                        Block
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                onClick={() =>
                                                    handlePurgeClick(user)
                                                }
                                                disabled={
                                                    user._id ===
                                                    currentUser?._id
                                                }
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                                                title="Permanently delete user and all data"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </AdminTableCell>
                                </AdminTableRow>
                            ))
                        )}
                    </AdminTableBody>
                </AdminTable>
                <AdminPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    basePath="/admin/users"
                    search={search}
                />
            </AdminTableContainer>

            {/* Purge Confirmation Dialog */}
            <AlertDialog open={purgeDialogOpen} onOpenChange={handlePurgeDialogClose}>
                <AlertDialogContent>
                    {/* Purging State */}
                    {isPurging && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-gray-900 dark:text-gray-100">
                                    Purging User...
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="flex flex-col items-center py-8 gap-4">
                                        <Loader2 className="h-12 w-12 animate-spin text-red-500" />
                                        <div className="text-center">
                                            Deleting all data for{" "}
                                            <strong>{userToPurge?.name}</strong>
                                        </div>
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                        </>
                    )}

                    {/* Result State */}
                    {!isPurging && purgeResult && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle className={purgeResult.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                    {purgeResult.success ? "✓ User Purged Successfully" : "✗ Purge Failed"}
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="space-y-3 text-sm text-muted-foreground">
                                        {purgeResult.success ? (
                                            <>
                                                <div>
                                                    <strong>{userToPurge?.name}</strong> ({userToPurge?.username}) has been permanently deleted.
                                                </div>
                                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
                                                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Deleted:</div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600 dark:text-gray-400">
                                                        <div>{purgeResult.results.chats} chats</div>
                                                        <div>{purgeResult.results.workspaces} workspaces</div>
                                                        <div>{purgeResult.results.tasks} tasks</div>
                                                        <div>{purgeResult.results.mediaItems} media items</div>
                                                        <div>{purgeResult.results.entities} entity links</div>
                                                        <div>{purgeResult.results.memories} memories</div>
                                                        <div>{purgeResult.results.memberships} memberships</div>
                                                        <div>{purgeResult.results.prompts} prompts</div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-red-600 dark:text-red-400">
                                                {purgeResult.error}
                                            </div>
                                        )}
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogAction onClick={handlePurgeDialogClose}>
                                    Done
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}

                    {/* Confirmation State */}
                    {!isPurging && !purgeResult && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-red-600 dark:text-red-400">
                                    ⚠️ Permanently Delete User
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div>
                                            Are you sure you want to permanently delete{" "}
                                            <strong>{userToPurge?.name}</strong> (
                                            {userToPurge?.username})?
                                        </div>
                                        <div className="text-red-600 dark:text-red-400 font-medium">
                                            This will permanently delete:
                                        </div>
                                        <ul className="list-disc list-inside text-sm space-y-1 text-gray-600 dark:text-gray-400">
                                            <li>All chats and messages</li>
                                            <li>All workspaces and applets</li>
                                            <li>All tasks and media items</li>
                                            <li>All entity associations</li>
                                            <li>All continuity memories</li>
                                            <li>User account and settings</li>
                                        </ul>
                                        <div className="font-bold text-red-600 dark:text-red-400 pt-2">
                                            This action cannot be undone!
                                        </div>
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handlePurgeConfirm}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    Delete Permanently
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
