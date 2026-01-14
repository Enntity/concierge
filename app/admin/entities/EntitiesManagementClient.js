"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import FilterInput from "@/src/components/common/FilterInput";
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
import { Badge } from "@/components/ui/badge";

export default function EntitiesManagementClient() {
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [entityToDelete, setEntityToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [purgeOrphanedOpen, setPurgeOrphanedOpen] = useState(false);
    const [isPurgingOrphaned, setIsPurgingOrphaned] = useState(false);
    const [purgeOrphanedResult, setPurgeOrphanedResult] = useState(null);
    const [editingEntityId, setEditingEntityId] = useState(null);
    const [editAssocUserIds, setEditAssocUserIds] = useState("");
    const [filterText, setFilterText] = useState("");
    const [sortBy, setSortBy] = useState("memoryCount");
    const [sortDir, setSortDir] = useState("desc");

    useEffect(() => {
        fetchEntities();
    }, []);

    const fetchEntities = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/entities");
            if (response.ok) {
                const data = await response.json();
                setEntities(data);
            }
        } catch (error) {
            console.error("Error fetching entities:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (entity) => {
        setEntityToDelete(entity);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!entityToDelete) return;

        setIsDeleting(true);
        try {
            const response = await fetch(
                `/api/admin/entities/${entityToDelete.id}/delete`,
                { method: "DELETE" },
            );

            if (response.ok) {
                setEntities(entities.filter((e) => e.id !== entityToDelete.id));
                setDeleteDialogOpen(false);
                setEntityToDelete(null);
            } else {
                const error = await response.json();
                alert(error.error || "Failed to delete entity");
            }
        } catch (error) {
            console.error("Error deleting entity:", error);
            alert("Failed to delete entity");
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePurgeOrphaned = async () => {
        setIsPurgingOrphaned(true);
        try {
            const response = await fetch("/api/admin/entities/purge-orphaned", {
                method: "POST",
            });

            if (response.ok) {
                const result = await response.json();
                setPurgeOrphanedResult({ success: true, ...result });
                fetchEntities();
            } else {
                const error = await response.json();
                setPurgeOrphanedResult({
                    success: false,
                    error: error.error || "Failed to purge orphaned entities",
                });
            }
        } catch (error) {
            console.error("Error purging orphaned entities:", error);
            setPurgeOrphanedResult({
                success: false,
                error: "Failed to purge orphaned entities",
            });
        } finally {
            setIsPurgingOrphaned(false);
        }
    };

    const handlePurgeOrphanedDialogClose = () => {
        setPurgeOrphanedOpen(false);
        setPurgeOrphanedResult(null);
    };

    const handleEditClick = (entity) => {
        setEditingEntityId(entity.id);
        setEditAssocUserIds(
            Array.isArray(entity.assocUserIds)
                ? entity.assocUserIds.join(", ")
                : "",
        );
    };

    const handleSaveEdit = async (entityId) => {
        const assocUserIdsArray = editAssocUserIds
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0);

        try {
            const response = await fetch(`/api/admin/entities/${entityId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assocUserIds: assocUserIdsArray }),
            });

            if (response.ok) {
                fetchEntities();
                setEditingEntityId(null);
                setEditAssocUserIds("");
            } else {
                const error = await response.json();
                alert(error.error || "Failed to update entity");
            }
        } catch (error) {
            console.error("Error updating entity:", error);
            alert("Failed to update entity");
        }
    };

    const handleCancelEdit = () => {
        setEditingEntityId(null);
        setEditAssocUserIds("");
    };

    const getAssocUserDisplay = (entity) => {
        if (
            Array.isArray(entity.assocUserLogins) &&
            entity.assocUserLogins.length
        ) {
            return entity.assocUserLogins;
        }
        if (Array.isArray(entity.assocUserIds) && entity.assocUserIds.length) {
            return entity.assocUserIds;
        }
        return [];
    };

    const handleSort = (key) => {
        if (key === sortBy) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
        }
        setSortBy(key);
        setSortDir(
            key === "memoryCount" || key === "assocUsers" ? "desc" : "asc",
        );
    };

    const visibleEntities = useMemo(() => {
        const query = filterText.trim().toLowerCase();
        const filtered = entities.filter((entity) => {
            if (!query) return true;
            const assocUsers = getAssocUserDisplay(entity).join(", ");
            return (
                entity.name?.toLowerCase().includes(query) ||
                entity.id?.toLowerCase().includes(query) ||
                assocUsers.toLowerCase().includes(query)
            );
        });

        const sorted = [...filtered].sort((a, b) => {
            const direction = sortDir === "desc" ? -1 : 1;
            if (sortBy === "name") {
                return (
                    (a.name || "").localeCompare(b.name || "", "en", {
                        sensitivity: "base",
                    }) * direction
                );
            }
            if (sortBy === "id") {
                return (
                    (a.id || "").localeCompare(b.id || "", "en", {
                        sensitivity: "base",
                    }) * direction
                );
            }
            if (sortBy === "type") {
                const aType = a.isSystem ? "system" : "user";
                const bType = b.isSystem ? "system" : "user";
                return (
                    aType.localeCompare(bType, "en", {
                        sensitivity: "base",
                    }) * direction
                );
            }
            if (sortBy === "assocUsers") {
                const aCount = getAssocUserDisplay(a).length;
                const bCount = getAssocUserDisplay(b).length;
                return (aCount - bCount) * direction;
            }
            const aCount = a.memoryCount || 0;
            const bCount = b.memoryCount || 0;
            return (aCount - bCount) * direction;
        });

        return sorted;
    }, [entities, filterText, sortBy, sortDir]);

    const orphanedCount = entities.filter(
        (e) => !e.isSystem && (!e.assocUserIds || e.assocUserIds.length === 0),
    ).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Entities
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage entities and their user associations
                    </p>
                </div>
                {orphanedCount > 0 && (
                    <Button
                        onClick={() => setPurgeOrphanedOpen(true)}
                        variant="destructive"
                        className="w-full sm:w-auto"
                    >
                        Purge {orphanedCount} Orphaned
                    </Button>
                )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <FilterInput
                    value={filterText}
                    onChange={setFilterText}
                    onClear={() => setFilterText("")}
                    placeholder="Filter by name, ID, or user..."
                    className="flex-1"
                />
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="memoryCount">Memories</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="id">ID</SelectItem>
                        <SelectItem value="type">Type</SelectItem>
                        <SelectItem value="assocUsers">Assoc users</SelectItem>
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
                                sortKey="id"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden md:table-cell"
                            >
                                ID
                            </AdminSortableHeader>
                            <AdminSortableHeader
                                sortKey="type"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                            >
                                Type
                            </AdminSortableHeader>
                            <AdminSortableHeader
                                sortKey="memoryCount"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden md:table-cell"
                            >
                                Memories
                            </AdminSortableHeader>
                            <AdminTableHeaderCell>
                                Associated Users
                            </AdminTableHeaderCell>
                            <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
                        </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                        {visibleEntities.length === 0 ? (
                            <AdminTableEmpty
                                colSpan={6}
                                message="No entities found"
                            />
                        ) : (
                            visibleEntities.map((entity) => (
                                <AdminTableRow key={entity.id}>
                                    <AdminTableCell className="font-medium text-gray-900 dark:text-gray-100">
                                        <div className="space-y-1">
                                            <div>
                                                {entity.name || "Unnamed"}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 md:hidden">
                                                <div className="font-mono break-all text-gray-700 dark:text-gray-200">
                                                    {entity.id}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span>
                                                        Memories:{" "}
                                                        {entity.memoryCount ||
                                                            0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </AdminTableCell>
                                    <AdminTableCell className="hidden md:table-cell font-mono text-xs text-gray-700 dark:text-gray-200">
                                        {entity.id}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        {entity.isSystem ? (
                                            <Badge variant="secondary">
                                                System
                                            </Badge>
                                        ) : (
                                            <Badge>User</Badge>
                                        )}
                                    </AdminTableCell>
                                    <AdminTableCell className="hidden md:table-cell text-gray-600 dark:text-gray-400">
                                        {entity.memoryCount || 0}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        {editingEntityId === entity.id ? (
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <Input
                                                    value={editAssocUserIds}
                                                    onChange={(e) =>
                                                        setEditAssocUserIds(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Comma-separated user IDs"
                                                    className="w-full sm:w-64"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleSaveEdit(
                                                            entity.id,
                                                        )
                                                    }
                                                    className="flex items-center gap-2"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    <span className="hidden sm:inline">
                                                        Save
                                                    </span>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={handleCancelEdit}
                                                    className="flex items-center gap-2"
                                                >
                                                    <X className="h-4 w-4" />
                                                    <span className="hidden sm:inline">
                                                        Cancel
                                                    </span>
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className="text-sm text-gray-600 dark:text-gray-400"
                                                    title={
                                                        Array.isArray(
                                                            entity.assocUserIds,
                                                        )
                                                            ? entity.assocUserIds.join(
                                                                  ", ",
                                                              )
                                                            : ""
                                                    }
                                                >
                                                    {getAssocUserDisplay(entity)
                                                        .length > 0
                                                        ? getAssocUserDisplay(
                                                              entity,
                                                          ).join(", ")
                                                        : entity.isSystem
                                                          ? "System"
                                                          : "None (orphaned)"}
                                                </span>
                                                {!entity.isSystem && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            handleEditClick(
                                                                entity,
                                                            )
                                                        }
                                                        className="flex items-center gap-2"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        <span className="hidden sm:inline">
                                                            Edit
                                                        </span>
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        {!entity.isSystem && (
                                            <Button
                                                onClick={() =>
                                                    handleDeleteClick(entity)
                                                }
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                                                aria-label="Delete entity"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </AdminTableCell>
                                </AdminTableRow>
                            ))
                        )}
                    </AdminTableBody>
                </AdminTable>
            </AdminTableContainer>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 dark:text-red-400">
                            Delete Entity
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div>
                                    Are you sure you want to delete entity{" "}
                                    <strong className="font-mono">
                                        {entityToDelete?.id}
                                    </strong>
                                    ?
                                </div>
                                <div className="text-red-600 dark:text-red-400 font-medium">
                                    This will permanently delete:
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                                    <li>
                                        All continuity memories for this entity
                                    </li>
                                    <li>The entity itself</li>
                                </ul>
                                <div className="font-bold text-red-600 dark:text-red-400 pt-2">
                                    This action cannot be undone!
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

            {/* Purge Orphaned Dialog */}
            <AlertDialog
                open={purgeOrphanedOpen}
                onOpenChange={handlePurgeOrphanedDialogClose}
            >
                <AlertDialogContent>
                    {/* Purging State */}
                    {isPurgingOrphaned && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-gray-900 dark:text-gray-100">
                                    Purging Orphaned Entities...
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="flex flex-col items-center py-8 gap-4">
                                        <Loader2 className="h-12 w-12 animate-spin text-red-500" />
                                        <div className="text-center">
                                            Deleting {orphanedCount} orphaned
                                            entities and their memories
                                        </div>
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                        </>
                    )}

                    {/* Result State */}
                    {!isPurgingOrphaned && purgeOrphanedResult && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle
                                    className={
                                        purgeOrphanedResult.success
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-red-600 dark:text-red-400"
                                    }
                                >
                                    {purgeOrphanedResult.success
                                        ? "✓ Purge Completed Successfully"
                                        : "✗ Purge Failed"}
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="space-y-3 text-sm text-muted-foreground">
                                        {purgeOrphanedResult.success ? (
                                            <>
                                                <div>
                                                    Orphaned entities have been
                                                    permanently deleted.
                                                </div>
                                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
                                                    <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Deleted:
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600 dark:text-gray-400">
                                                        <div>
                                                            {
                                                                purgeOrphanedResult.deletedEntities
                                                            }{" "}
                                                            entities
                                                        </div>
                                                        <div>
                                                            {
                                                                purgeOrphanedResult.deletedMemories
                                                            }{" "}
                                                            memories
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-red-600 dark:text-red-400">
                                                {purgeOrphanedResult.error}
                                            </div>
                                        )}
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogAction
                                    onClick={handlePurgeOrphanedDialogClose}
                                >
                                    Done
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}

                    {/* Confirmation State */}
                    {!isPurgingOrphaned && !purgeOrphanedResult && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-red-600 dark:text-red-400">
                                    Purge Orphaned Entities
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div>
                                            Are you sure you want to purge{" "}
                                            <strong>{orphanedCount}</strong>{" "}
                                            orphaned entities?
                                        </div>
                                        <div className="text-red-600 dark:text-red-400 font-medium">
                                            This will permanently delete:
                                        </div>
                                        <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                                            <li>
                                                All continuity memories for
                                                orphaned entities
                                            </li>
                                            <li>
                                                All orphaned entities (no
                                                assocUserIds)
                                            </li>
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
                                    onClick={handlePurgeOrphaned}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    Purge
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
