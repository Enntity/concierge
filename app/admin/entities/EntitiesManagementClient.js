"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Loader2 } from "lucide-react";
import {
    AdminTableContainer,
    AdminTable,
    AdminTableHead,
    AdminTableBody,
    AdminTableHeaderCell,
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
            <div className="flex justify-between items-center">
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
                    >
                        Purge {orphanedCount} Orphaned
                    </Button>
                )}
            </div>

            <AdminTableContainer>
                <AdminTable>
                    <AdminTableHead>
                        <tr>
                            <AdminTableHeaderCell>Name</AdminTableHeaderCell>
                            <AdminTableHeaderCell>ID</AdminTableHeaderCell>
                            <AdminTableHeaderCell>Type</AdminTableHeaderCell>
                            <AdminTableHeaderCell>
                                Memories
                            </AdminTableHeaderCell>
                            <AdminTableHeaderCell>
                                Associated Users
                            </AdminTableHeaderCell>
                            <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
                        </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                        {entities.length === 0 ? (
                            <AdminTableEmpty
                                colSpan={6}
                                message="No entities found"
                            />
                        ) : (
                            entities.map((entity) => (
                                <AdminTableRow key={entity.id}>
                                    <AdminTableCell className="font-medium text-gray-900 dark:text-gray-100">
                                        {entity.name || "Unnamed"}
                                    </AdminTableCell>
                                    <AdminTableCell className="font-mono text-xs">
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
                                    <AdminTableCell className="text-gray-600 dark:text-gray-400">
                                        {entity.memoryCount || 0}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        {editingEntityId === entity.id ? (
                                            <div className="flex gap-2">
                                                <Input
                                                    value={editAssocUserIds}
                                                    onChange={(e) =>
                                                        setEditAssocUserIds(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Comma-separated user IDs"
                                                    className="w-64"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleSaveEdit(
                                                            entity.id,
                                                        )
                                                    }
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={handleCancelEdit}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    {Array.isArray(
                                                        entity.assocUserIds,
                                                    ) &&
                                                    entity.assocUserIds.length >
                                                        0
                                                        ? entity.assocUserIds.join(
                                                              ", ",
                                                          )
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
                                                    >
                                                        Edit
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
