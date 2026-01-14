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
import { Ban, CheckCircle } from "lucide-react";
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

export default function UserManagementClient({
    initialUsers,
    currentUser,
    totalPages,
    currentPage,
    search: initialSearch,
}) {
    const [users, setUsers] = useState(initialUsers);
    const [search, setSearch] = useState(initialSearch || "");
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
        </div>
    );
}
