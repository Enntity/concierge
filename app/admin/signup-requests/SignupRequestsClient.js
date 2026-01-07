"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Mail, User, Calendar } from "lucide-react";
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

export default function SignupRequestsClient({
    initialRequests,
    totalPages,
    currentPage,
    search: initialSearch,
}) {
    const [requests, setRequests] = useState(initialRequests);
    const [search, setSearch] = useState(initialSearch || "");
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
            <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                        type="text"
                        placeholder="Search by email, name, or domain..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Button type="submit">Search</Button>
                {search && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            setSearch("");
                            router.push("/admin/signup-requests");
                        }}
                    >
                        Clear
                    </Button>
                )}
            </form>

            <AdminTableContainer>
                <AdminTable>
                    <AdminTableHead>
                        <tr>
                            <AdminTableHeaderCell>Email</AdminTableHeaderCell>
                            <AdminTableHeaderCell>Name</AdminTableHeaderCell>
                            <AdminTableHeaderCell>Domain</AdminTableHeaderCell>
                            <AdminTableHeaderCell>
                                Requested
                            </AdminTableHeaderCell>
                        </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                        {requests.length === 0 ? (
                            <AdminTableEmpty
                                colSpan={4}
                                message="No signup requests found"
                            />
                        ) : (
                            requests.map((request) => (
                                <AdminTableRow key={request._id}>
                                    <AdminTableCell>
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-gray-400" />
                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                                {request.email}
                                            </span>
                                        </div>
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-gray-400" />
                                            <span className="text-gray-900 dark:text-gray-100">
                                                {request.name}
                                            </span>
                                        </div>
                                    </AdminTableCell>
                                    <AdminTableCell className="text-gray-900 dark:text-gray-100">
                                        {request.domain}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                            <Calendar className="h-4 w-4" />
                                            {formatDate(request.requestedAt)}
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
                    basePath="/admin/signup-requests"
                    search={search}
                />
            </AdminTableContainer>
        </div>
    );
}
