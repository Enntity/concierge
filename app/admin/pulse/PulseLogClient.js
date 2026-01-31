"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 50;

const STATUS_COLORS = {
    completed:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    in_progress:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    skipped:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const SIGNAL_LABELS = {
    rest: "Resting",
    tool_limit: "Auto-continue",
    error: "Error",
};

function formatDuration(ms) {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

function formatTime(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

export default function PulseLogClient() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset] = useState(0);
    const [filterEntity, setFilterEntity] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [detailLog, setDetailLog] = useState(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("limit", PAGE_SIZE.toString());
            params.set("offset", offset.toString());
            if (filterEntity !== "all") params.set("entityId", filterEntity);
            if (filterStatus !== "all") params.set("status", filterStatus);

            const response = await fetch(`/api/admin/pulse?${params}`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs);
                setTotal(data.total);
                if (data.entities) setEntities(data.entities);
            }
        } catch (error) {
            console.error("Error fetching pulse logs:", error);
        } finally {
            setLoading(false);
        }
    }, [offset, filterEntity, filterStatus]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Reset offset when filters change
    useEffect(() => {
        setOffset(0);
    }, [filterEntity, filterStatus]);

    const pageCount = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Pulse Logs
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Life loop wake history across all entities
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={filterEntity} onValueChange={setFilterEntity}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                        <SelectValue placeholder="Filter by entity" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All entities</SelectItem>
                        {entities.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                                {e.name || e.id} ({e.count})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="skipped">Skipped</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                    </SelectContent>
                </Select>
                <div className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                    {total} total logs
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : (
                <>
                    <AdminTableContainer>
                        <AdminTable>
                            <AdminTableHead>
                                <tr>
                                    <AdminTableHeaderCell>
                                        Entity
                                    </AdminTableHeaderCell>
                                    <AdminTableHeaderCell>
                                        Time
                                    </AdminTableHeaderCell>
                                    <AdminTableHeaderCell>
                                        Type
                                    </AdminTableHeaderCell>
                                    <AdminTableHeaderCell>
                                        Status
                                    </AdminTableHeaderCell>
                                    <AdminTableHeaderCell className="hidden md:table-cell">
                                        Signal
                                    </AdminTableHeaderCell>
                                    <AdminTableHeaderCell className="hidden md:table-cell">
                                        Chain
                                    </AdminTableHeaderCell>
                                    <AdminTableHeaderCell className="hidden md:table-cell">
                                        Duration
                                    </AdminTableHeaderCell>
                                    <AdminTableHeaderCell>
                                        Details
                                    </AdminTableHeaderCell>
                                </tr>
                            </AdminTableHead>
                            <AdminTableBody>
                                {logs.length === 0 ? (
                                    <AdminTableEmpty
                                        colSpan={8}
                                        message="No pulse logs found"
                                    />
                                ) : (
                                    logs.map((log) => (
                                        <AdminTableRow key={log.id}>
                                            <AdminTableCell className="font-medium text-gray-900 dark:text-gray-100">
                                                {log.entityName || "Unknown"}
                                            </AdminTableCell>
                                            <AdminTableCell className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                {formatTime(log.createdAt)}
                                            </AdminTableCell>
                                            <AdminTableCell>
                                                <Badge
                                                    variant={
                                                        log.wakeType ===
                                                        "scheduled"
                                                            ? "secondary"
                                                            : "outline"
                                                    }
                                                >
                                                    {log.wakeType}
                                                </Badge>
                                            </AdminTableCell>
                                            <AdminTableCell>
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[log.status] || ""}`}
                                                >
                                                    {log.status}
                                                </span>
                                            </AdminTableCell>
                                            <AdminTableCell className="hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">
                                                {log.endSignal
                                                    ? SIGNAL_LABELS[
                                                          log.endSignal
                                                      ] || log.endSignal
                                                    : log.skipReason || "-"}
                                            </AdminTableCell>
                                            <AdminTableCell className="hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">
                                                {log.chainDepth > 0
                                                    ? log.chainDepth
                                                    : "-"}
                                            </AdminTableCell>
                                            <AdminTableCell className="hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">
                                                {formatDuration(log.durationMs)}
                                            </AdminTableCell>
                                            <AdminTableCell>
                                                {(log.taskContext ||
                                                    log.reflection ||
                                                    log.error) && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setDetailLog(log)
                                                        }
                                                        className="text-xs"
                                                    >
                                                        View
                                                    </Button>
                                                )}
                                            </AdminTableCell>
                                        </AdminTableRow>
                                    ))
                                )}
                            </AdminTableBody>
                        </AdminTable>
                    </AdminTableContainer>

                    {/* Pagination */}
                    {pageCount > 1 && (
                        <div className="flex items-center justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={offset === 0}
                                onClick={() =>
                                    setOffset(Math.max(0, offset - PAGE_SIZE))
                                }
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Page {currentPage} of {pageCount}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={offset + PAGE_SIZE >= total}
                                onClick={() => setOffset(offset + PAGE_SIZE)}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* Detail Dialog */}
            <AlertDialog
                open={!!detailLog}
                onOpenChange={() => setDetailLog(null)}
            >
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {detailLog?.entityName} &mdash;{" "}
                            {formatTime(detailLog?.createdAt)}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
                                    <div>
                                        Status:{" "}
                                        <span className="font-medium">
                                            {detailLog?.status}
                                        </span>
                                    </div>
                                    <div>
                                        Type:{" "}
                                        <span className="font-medium">
                                            {detailLog?.wakeType}
                                        </span>
                                    </div>
                                    <div>
                                        Signal:{" "}
                                        <span className="font-medium">
                                            {detailLog?.endSignal ||
                                                detailLog?.skipReason ||
                                                "-"}
                                        </span>
                                    </div>
                                    <div>
                                        Duration:{" "}
                                        <span className="font-medium">
                                            {formatDuration(
                                                detailLog?.durationMs,
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {detailLog?.taskContext && (
                                    <div>
                                        <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Task Context:
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                            {detailLog.taskContext}
                                        </div>
                                    </div>
                                )}

                                {detailLog?.reflection && (
                                    <div>
                                        <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Reflection:
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-gray-600 dark:text-gray-400 whitespace-pre-wrap italic">
                                            {detailLog.reflection}
                                        </div>
                                    </div>
                                )}

                                {detailLog?.error && (
                                    <div>
                                        <div className="font-medium text-red-600 dark:text-red-400 mb-1">
                                            Error:
                                        </div>
                                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-red-600 dark:text-red-400">
                                            {detailLog.error}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction>Close</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
