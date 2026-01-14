"use client";

import i18next from "i18next";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";

export default function SortableHeaderButton({
    children,
    sortKey,
    currentSort,
    currentDirection,
    onSort,
    className = "",
    iconClassName = "",
}) {
    const isRtl = i18next.language === "ar";
    const isActive = currentSort === sortKey;
    const Icon = isActive
        ? currentDirection === "asc"
            ? ChevronUp
            : ChevronDown
        : ArrowUpDown;

    return (
        <button
            onClick={() => onSort(sortKey)}
            className={`flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-gray-600 dark:text-gray-400 ${isRtl ? "flex-row-reverse" : ""} ${className}`}
            type="button"
        >
            {children}
            <Icon
                className={`h-3.5 w-3.5 ${
                    isActive ? "text-sky-600 dark:text-sky-400" : ""
                } ${iconClassName}`}
            />
        </button>
    );
}
