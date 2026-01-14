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
import { Mail, User, Calendar, Check } from "lucide-react";
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
    AdminPagination,
} from "../components/AdminTable";

function SignupRequestRow({ request, formatDate, onApprove }) {
    const [isApproving, setIsApproving] = useState(false);

    const handleApprove = async () => {
        setIsApproving(true);
        try {
            const response = await fetch(
                `/api/signup-requests/${request._id}/approve`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                },
            );

            if (response.ok) {
                onApprove();
            } else {
                const error = await response.json();
                alert(error.error || "Failed to approve signup request");
            }
        } catch (error) {
            console.error("Error approving signup request:", error);
            alert("Failed to approve signup request");
        } finally {
            setIsApproving(false);
        }
    };

    return (
        <AdminTableRow>
            <AdminTableCell>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            {request.email}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                        {request.name} • {request.domain} •{" "}
                        {formatDate(request.requestedAt)}
                    </div>
                </div>
            </AdminTableCell>
            <AdminTableCell className="hidden sm:table-cell">
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 dark:text-gray-100">
                        {request.name}
                    </span>
                </div>
            </AdminTableCell>
            <AdminTableCell className="hidden md:table-cell text-gray-900 dark:text-gray-100">
                {request.domain}
            </AdminTableCell>
            <AdminTableCell className="hidden md:table-cell">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    {formatDate(request.requestedAt)}
                </div>
            </AdminTableCell>
            <AdminTableCell>
                <Button
                    onClick={handleApprove}
                    disabled={isApproving}
                    size="sm"
                    className="flex items-center gap-2"
                    aria-label="Approve signup request"
                >
                    <Check className="h-4 w-4" />
                    <span className="hidden sm:inline">
                        {isApproving ? "Approving..." : "Approve"}
                    </span>
                </Button>
            </AdminTableCell>
        </AdminTableRow>
    );
}

export default function SignupRequestsClient({
    initialRequests,
    totalPages,
    currentPage,
    search: initialSearch,
}) {
    const [requests, setRequests] = useState(initialRequests);
    const [search, setSearch] = useState(initialSearch || "");
    const [sortBy, setSortBy] = useState("requestedAt");
    const [sortDir, setSortDir] = useState("desc");
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        setRequests(initialRequests);
    }, [initialRequests]);

    const handleSearch = (e) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        search ? params.set("search", search) : params.delete("search");
        params.set("page", "1");
        router.push(`/admin/signup-requests?${params.toString()}`);
    };

    const handleClearSearch = () => {
        setSearch("");
        const params = new URLSearchParams(searchParams.toString());
        params.delete("search");
        params.set("page", "1");
        router.push("/admin/signup-requests");
    };

    const formatDate = (dateString) =>
        new Date(dateString).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const handleSort = (key) => {
        if (key === sortBy) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
        }
        setSortBy(key);
        setSortDir(key === "requestedAt" ? "desc" : "asc");
    };

    const visibleRequests = useMemo(() => {
        const sorted = [...requests].sort((a, b) => {
            const direction = sortDir === "desc" ? -1 : 1;
            if (sortBy === "email") {
                return (
                    a.email.localeCompare(b.email, "en", {
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
            if (sortBy === "domain") {
                return (
                    a.domain.localeCompare(b.domain, "en", {
                        sensitivity: "base",
                    }) * direction
                );
            }
            const aDate = new Date(a.requestedAt).getTime();
            const bDate = new Date(b.requestedAt).getTime();
            return (aDate - bDate) * direction;
        });

        return sorted;
    }, [requests, sortBy, sortDir]);

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
                    placeholder="Search by email, name, or domain..."
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
                        <SelectItem value="requestedAt">Requested</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="domain">Domain</SelectItem>
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
                                sortKey="email"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                            >
                                Email
                            </AdminSortableHeader>
                            <AdminSortableHeader
                                sortKey="name"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden sm:table-cell"
                            >
                                Name
                            </AdminSortableHeader>
                            <AdminSortableHeader
                                sortKey="domain"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden md:table-cell"
                            >
                                Domain
                            </AdminSortableHeader>
                            <AdminSortableHeader
                                sortKey="requestedAt"
                                currentSort={sortBy}
                                currentDirection={sortDir}
                                onSort={handleSort}
                                className="hidden md:table-cell"
                            >
                                Requested
                            </AdminSortableHeader>
                            <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
                        </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                        {visibleRequests.length === 0 ? (
                            <AdminTableEmpty
                                colSpan={5}
                                message="No signup requests found"
                            />
                        ) : (
                            visibleRequests.map((request) => (
                                <SignupRequestRow
                                    key={request._id}
                                    request={request}
                                    formatDate={formatDate}
                                    onApprove={() => {
                                        setRequests(
                                            requests.filter(
                                                (r) => r._id !== request._id,
                                            ),
                                        );
                                    }}
                                />
                            ))
                        )}
                    </AdminTableBody>
                </AdminTable>
                <AdminPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    basePath="/admin/signup-requests"
                    search={search}
                />
            </AdminTableContainer>
        </div>
    );
}
