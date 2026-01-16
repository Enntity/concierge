"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import FilterInput from "@/src/components/common/FilterInput";
import {
    Ban,
    CheckCircle,
    Trash2,
    Loader2,
    Clock,
    ShieldCheck,
} from "lucide-react";
import {
    AdminTableContainer,
    AdminTable,
    AdminTableHead,
    AdminTableBody,
    AdminTableHeaderCell,
    AdminSortableHeader,
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
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("lastActiveAt");
    const [sortDir, setSortDir] = useState("desc");
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

    const handleClearSearch = () => {
        setSearch("");
        const params = new URLSearchParams(searchParams.toString());
        params.delete("search");
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
                setPurgeResult({
                    success: false,
                    error: error.error || "Failed to purge user",
                });
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

    const formatLastLogin = (dateString) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const handleSort = (key) => {
        if (key === sortBy) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
        }
        setSortBy(key);
        setSortDir(key === "lastActiveAt" ? "desc" : "asc");
    };

    const visibleUsers = useMemo(() => {
        const filtered = users.filter((user) => {
            const roleMatch =
                roleFilter === "all" || (user.role || "user") === roleFilter;
            const statusMatch =
                statusFilter === "all" ||
                (statusFilter === "blocked" && user.blocked) ||
                (statusFilter === "active" && !user.blocked);
            return roleMatch && statusMatch;
        });

        const sorted = [...filtered].sort((a, b) => {
            const direction = sortDir === "desc" ? -1 : 1;
            if (sortBy === "name") {
                return (
                    a.name.localeCompare(b.name, "en", {
                        sensitivity: "base",
                    }) * direction
                );
            }
            if (sortBy === "username") {
                return (
                    a.username.localeCompare(b.username, "en", {
                        sensitivity: "base",
                    }) * direction
                );
            }
            const aLast = a.lastActiveAt
                ? new Date(a.lastActiveAt).getTime()
                : 0;
            const bLast = b.lastActiveAt
                ? new Date(b.lastActiveAt).getTime()
                : 0;
            return (aLast - bLast) * direction;
        });

        return sorted;
    }, [users, roleFilter, statusFilter, sortBy, sortDir]);

    return (
        <div className="space-y-6">
            <form
                onSubmit={handleSearch}
                className="flex flex-col gap-2 sm:flex-row"
            >
                <FilterInput
                    value={search}
                    onChange={setSearch}
                    onClear={handleClearSearch}
                    placeholder="Search by name or username..."
                    className="flex-grow"
                />
                <Button type="submit" className="sm:w-auto w-full">
                    Search
                </Button>
            </form>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="lastActiveAt">Last login</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="username">Username</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={sortDir} onValueChange={setSortDir}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <AdminTableContainer>
                <AdminTable>
                    <AdminTableHead>
                        <tr>
                            <AdminSortableHeader
                                sortKey="name"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                            >
                                Name
                            </AdminSortableHeader>
                            <AdminSortableHeader
                                sortKey="username"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden sm:table-cell"
                            >
                                Username
                            </AdminSortableHeader>
                            <AdminTableHeaderCell className="hidden md:table-cell">
                                Role
                            </AdminTableHeaderCell>
                            <AdminTableHeaderCell className="hidden md:table-cell">
                                Status
                            </AdminTableHeaderCell>
                            <AdminSortableHeader
                                sortKey="lastActiveAt"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden lg:table-cell"
                            >
                                Last Login
                            </AdminSortableHeader>
                            <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
                        </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                        {visibleUsers.length === 0 ? (
                            <AdminTableEmpty
                                colSpan={6}
                                message="No users found"
                            />
                        ) : (
                            visibleUsers.map((user) => (
                                <AdminTableRow key={user._id}>
                                    <AdminTableCell className="font-medium text-gray-900 dark:text-gray-100">
                                        <div className="space-y-1">
                                            <div
                                                className="max-w-[180px] sm:max-w-[240px] truncate"
                                                title={user.name}
                                            >
                                                {user.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                                                <div
                                                    className="max-w-[220px] truncate"
                                                    title={user.username}
                                                >
                                                    {user.username}
                                                </div>
                                                <div className="flex flex-nowrap items-center gap-2 min-w-0">
                                                    <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                                                        {user.role || "user"}
                                                    </span>
                                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                        {user.blocked
                                                            ? "Blocked"
                                                            : "Active"}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                                        <Clock className="h-3 w-3" />
                                                        {formatLastLogin(
                                                            user.lastActiveAt,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </AdminTableCell>
                                    <AdminTableCell className="hidden sm:table-cell text-gray-500 dark:text-gray-400 max-w-[220px] truncate">
                                        <span title={user.username}>
                                            {user.username}
                                        </span>
                                    </AdminTableCell>
                                    <AdminTableCell className="hidden md:table-cell">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                                            {user.role || "user"}
                                        </span>
                                    </AdminTableCell>
                                    <AdminTableCell className="hidden md:table-cell">
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
                                    <AdminTableCell className="hidden lg:table-cell text-gray-500 dark:text-gray-400">
                                        <span
                                            title={formatLastLogin(
                                                user.lastActiveAt,
                                            )}
                                        >
                                            {formatLastLogin(user.lastActiveAt)}
                                        </span>
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        <div className="flex flex-nowrap gap-2">
                                            <Toggle
                                                pressed={
                                                    (user.role || "user") ===
                                                    "admin"
                                                }
                                                onPressedChange={(pressed) =>
                                                    handleRoleChange(
                                                        user._id,
                                                        pressed
                                                            ? "admin"
                                                            : "user",
                                                    )
                                                }
                                                disabled={
                                                    user._id ===
                                                    currentUser?._id
                                                }
                                                size="sm"
                                                variant="outline"
                                                className="w-9 px-0"
                                                title="Toggle admin role"
                                                aria-label="Toggle admin role"
                                            >
                                                <ShieldCheck className="h-4 w-4" />
                                            </Toggle>
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
                                                size="icon"
                                                className="h-9 w-9"
                                                aria-label={
                                                    user.blocked
                                                        ? "Unblock user"
                                                        : "Block user"
                                                }
                                                title={
                                                    user.blocked
                                                        ? "Unblock user"
                                                        : "Block user"
                                                }
                                            >
                                                {user.blocked ? (
                                                    <CheckCircle className="h-4 w-4" />
                                                ) : (
                                                    <Ban className="h-4 w-4" />
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
                                                aria-label="Permanently delete user and all data"
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
            <AlertDialog
                open={purgeDialogOpen}
                onOpenChange={handlePurgeDialogClose}
            >
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
                                <AlertDialogTitle
                                    className={
                                        purgeResult.success
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                    }
                                >
                                    {purgeResult.success
                                        ? "✓ User Purged Successfully"
                                        : "✗ Purge Failed"}
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="space-y-3 text-sm text-muted-foreground">
                                        {purgeResult.success ? (
                                            <>
                                                <div>
                                                    <strong>
                                                        {userToPurge?.name}
                                                    </strong>{" "}
                                                    ({userToPurge?.username})
                                                    has been permanently
                                                    deleted.
                                                </div>
                                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
                                                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Deleted:
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600 dark:text-gray-400">
                                                        <div>
                                                            {
                                                                purgeResult
                                                                    .results
                                                                    .chats
                                                            }{" "}
                                                            chats
                                                        </div>
                                                        <div>
                                                            {
                                                                purgeResult
                                                                    .results
                                                                    .workspaces
                                                            }{" "}
                                                            workspaces
                                                        </div>
                                                        <div>
                                                            {
                                                                purgeResult
                                                                    .results
                                                                    .tasks
                                                            }{" "}
                                                            tasks
                                                        </div>
                                                        <div>
                                                            {
                                                                purgeResult
                                                                    .results
                                                                    .mediaItems
                                                            }{" "}
                                                            media items
                                                        </div>
                                                        <div>
                                                            {
                                                                purgeResult
                                                                    .results
                                                                    .entities
                                                            }{" "}
                                                            entity links
                                                        </div>
                                                        <div>
                                                            {
                                                                purgeResult
                                                                    .results
                                                                    .memories
                                                            }{" "}
                                                            memories
                                                        </div>
                                                        <div>
                                                            {
                                                                purgeResult
                                                                    .results
                                                                    .memberships
                                                            }{" "}
                                                            memberships
                                                        </div>
                                                        <div>
                                                            {
                                                                purgeResult
                                                                    .results
                                                                    .prompts
                                                            }{" "}
                                                            prompts
                                                        </div>
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
                                <AlertDialogAction
                                    onClick={handlePurgeDialogClose}
                                >
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
                                            Are you sure you want to permanently
                                            delete{" "}
                                            <strong>{userToPurge?.name}</strong>{" "}
                                            ({userToPurge?.username})?
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
