"use client";

import React from "react";
import SortableHeaderButton from "@/src/components/common/SortableHeaderButton";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

// Shared table container with consistent styling
export function AdminTableContainer({ children }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">{children}</div>
        </div>
    );
}

// Shared table with consistent styling
export function AdminTable({ children }) {
    return (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            {children}
        </table>
    );
}

export function AdminTableHead({ children }) {
    return <thead className="bg-gray-50 dark:bg-gray-900">{children}</thead>;
}

export function AdminTableBody({ children }) {
    return (
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {children}
        </tbody>
    );
}

export function AdminTableHeaderCell({ children, className = "" }) {
    return (
        <th
            className={`px-3 py-2 sm:px-6 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${className}`}
        >
            {children}
        </th>
    );
}

export function AdminSortableHeader({
    children,
    sortKey,
    currentSort,
    currentDirection,
    onSort,
    className = "",
}) {
    return (
        <AdminTableHeaderCell className={className}>
            <SortableHeaderButton
                sortKey={sortKey}
                currentSort={currentSort}
                currentDirection={currentDirection}
                onSort={onSort}
            >
                {children}
            </SortableHeaderButton>
        </AdminTableHeaderCell>
    );
}

export function AdminTableRow({ children }) {
    return (
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            {children}
        </tr>
    );
}

export function AdminTableCell({ children, className = "" }) {
    return (
        <td
            className={`px-3 py-2 sm:px-6 sm:py-3 whitespace-normal sm:whitespace-nowrap align-middle text-xs sm:text-sm [&_svg]:align-middle ${className}`}
        >
            {children}
        </td>
    );
}

export function AdminTableEmpty({ colSpan, message = "No data found" }) {
    return (
        <tr>
            <td
                colSpan={colSpan}
                className="px-3 py-6 sm:px-6 sm:py-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
                {message}
            </td>
        </tr>
    );
}

// Shared pagination component
export function AdminPagination({ currentPage, totalPages, basePath, search }) {
    if (totalPages <= 1) return null;

    const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
        (page) =>
            page === 1 ||
            page === totalPages ||
            (page >= currentPage - 2 && page <= currentPage + 2),
    );

    return (
        <div className="px-3 py-3 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-gray-700">
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href={`${basePath}?page=${currentPage - 1}${searchParam}`}
                            className={
                                currentPage <= 1
                                    ? "pointer-events-none opacity-50"
                                    : ""
                            }
                        />
                    </PaginationItem>

                    {pages.map((page, index, array) => (
                        <React.Fragment key={page}>
                            {index > 0 && array[index - 1] !== page - 1 && (
                                <PaginationItem>
                                    <span className="px-2 text-gray-500 dark:text-gray-400">
                                        …
                                    </span>
                                </PaginationItem>
                            )}
                            <PaginationItem>
                                <PaginationLink
                                    href={`${basePath}?page=${page}${searchParam}`}
                                    isActive={currentPage === page}
                                >
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        </React.Fragment>
                    ))}

                    <PaginationItem>
                        <PaginationNext
                            href={`${basePath}?page=${currentPage + 1}${searchParam}`}
                            className={
                                currentPage >= totalPages
                                    ? "pointer-events-none opacity-50"
                                    : ""
                            }
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
}
