"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
import FilterInput from "@/src/components/common/FilterInput";
import { Loader2, Trash2 } from "lucide-react";
import {
    AdminTableContainer,
    AdminTable,
    AdminTableHead,
    AdminTableBody,
    AdminSortableHeader,
    AdminTableHeaderCell,
    AdminTableRow,
    AdminTableCell,
    AdminTableEmpty,
    AdminPagination,
} from "../components/AdminTable";

export default function FeedbackManagementClient({
    initialFeedback,
    totalPages,
    currentPage,
    search: initialSearch,
}) {
    const [feedback, setFeedback] = useState(initialFeedback);
    const [search, setSearch] = useState(initialSearch || "");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortDir, setSortDir] = useState("desc");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [feedbackToDelete, setFeedbackToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        setFeedback(initialFeedback);
    }, [initialFeedback]);

    const handleSearch = (e) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        search ? params.set("search", search) : params.delete("search");
        params.set("page", "1");
        router.push(`/admin/feedback?${params.toString()}`);
    };

    const handleClearSearch = () => {
        setSearch("");
        const params = new URLSearchParams(searchParams.toString());
        params.delete("search");
        params.set("page", "1");
        router.push("/admin/feedback");
    };

    const handleSort = (key) => {
        if (key === sortBy) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
        }
        setSortBy(key);
        setSortDir(key === "createdAt" ? "desc" : "asc");
    };

    const handleDeleteClick = (entry) => {
        setFeedbackToDelete(entry);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!feedbackToDelete) return;
        setIsDeleting(true);
        try {
            const response = await fetch(
                `/api/admin/feedback/${feedbackToDelete._id}/delete`,
                { method: "DELETE" },
            );
            if (response.ok) {
                setFeedback(
                    feedback.filter((f) => f._id !== feedbackToDelete._id),
                );
                setDeleteDialogOpen(false);
                setFeedbackToDelete(null);
            } else {
                const error = await response.json();
                alert(error.error || "Failed to delete feedback");
            }
        } catch (error) {
            console.error("Error deleting feedback:", error);
            alert("Failed to delete feedback");
        } finally {
            setIsDeleting(false);
        }
    };

    const visibleFeedback = useMemo(() => {
        const direction = sortDir === "desc" ? -1 : 1;
        return [...feedback].sort((a, b) => {
            if (sortBy === "username") {
                return (
                    a.username.localeCompare(b.username, "en", {
                        sensitivity: "base",
                    }) * direction
                );
            }
            if (sortBy === "name") {
                return (
                    a.name.localeCompare(b.name, "en", {
                        sensitivity: "base",
                    }) * direction
                );
            }
            const aDate = new Date(a.createdAt).getTime();
            const bDate = new Date(b.createdAt).getTime();
            return (aDate - bDate) * direction;
        });
    }, [feedback, sortBy, sortDir]);

    const formatDate = (dateString) =>
        new Date(dateString).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

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
                    placeholder="Search feedback..."
                    className="flex-1"
                />
                <Button type="submit" className="sm:w-auto w-full">
                    Search
                </Button>
            </form>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="createdAt">Submitted</SelectItem>
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
                                sortKey="createdAt"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                            >
                                Submitted
                            </AdminSortableHeader>
                            <AdminSortableHeader
                                sortKey="name"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden md:table-cell"
                            >
                                Name
                            </AdminSortableHeader>
                            <AdminSortableHeader
                                sortKey="username"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden md:table-cell"
                            >
                                Username
                            </AdminSortableHeader>
                            <AdminTableHeaderCell>Message</AdminTableHeaderCell>
                            <AdminTableHeaderCell className="hidden sm:table-cell">
                                Screenshot
                            </AdminTableHeaderCell>
                            <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
                        </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                        {visibleFeedback.length === 0 ? (
                            <AdminTableEmpty
                                colSpan={6}
                                message="No feedback found"
                            />
                        ) : (
                            visibleFeedback.map((entry) => (
                                <AdminTableRow key={entry._id}>
                                    <AdminTableCell className="text-gray-600 dark:text-gray-300">
                                        <div className="space-y-1">
                                            <div>
                                                {formatDate(entry.createdAt)}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 md:hidden">
                                                <div
                                                    className="max-w-[220px] truncate"
                                                    title={entry.name}
                                                >
                                                    {entry.name}
                                                </div>
                                                <div
                                                    className="max-w-[220px] truncate"
                                                    title={entry.username}
                                                >
                                                    {entry.username}
                                                </div>
                                            </div>
                                        </div>
                                    </AdminTableCell>
                                    <AdminTableCell className="hidden md:table-cell text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                                        <span title={entry.name}>
                                            {entry.name}
                                        </span>
                                    </AdminTableCell>
                                    <AdminTableCell className="hidden md:table-cell text-gray-500 dark:text-gray-400 max-w-[220px] truncate">
                                        <span title={entry.username}>
                                            {entry.username}
                                        </span>
                                    </AdminTableCell>
                                    <AdminTableCell className="max-w-xs sm:max-w-md text-gray-700 dark:text-gray-200 whitespace-normal line-clamp-3 break-words">
                                        <span title={entry.message}>
                                            {entry.message}
                                        </span>
                                    </AdminTableCell>
                                    <AdminTableCell className="hidden sm:table-cell">
                                        {entry.screenshot ? (
                                            <a
                                                href={entry.screenshot}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                                            >
                                                View
                                            </a>
                                        ) : (
                                            <span className="text-gray-400">
                                                —
                                            </span>
                                        )}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                handleDeleteClick(entry)
                                            }
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                                            aria-label="Delete feedback"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AdminTableCell>
                                </AdminTableRow>
                            ))
                        )}
                    </AdminTableBody>
                </AdminTable>
                <AdminPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    basePath="/admin/feedback"
                    search={search}
                />
            </AdminTableContainer>

            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 dark:text-red-400">
                            Delete Feedback
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div>
                                    Are you sure you want to delete this
                                    feedback entry?
                                </div>
                                <div className="text-red-600 dark:text-red-400 font-medium">
                                    This action cannot be undone.
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
