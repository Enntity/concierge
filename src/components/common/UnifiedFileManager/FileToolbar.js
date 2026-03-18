"use client";

import { useTranslation } from "react-i18next";
import {
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Folder,
    List,
    LayoutGrid,
    Upload,
    RefreshCw,
} from "lucide-react";
import FilterInput from "../FilterInput";

function getBreadcrumbLabel(segment, chatTitleMap, t) {
    if (segment === "global") return t("Global Files");
    if (segment === "chats") return t("Chat Files");
    if (segment === "media") return t("Media");
    if (segment === "profile") return t("Profile");
    if (chatTitleMap && chatTitleMap[segment]) {
        return chatTitleMap[segment];
    }
    return segment;
}

export default function FileToolbar({
    breadcrumbs = [],
    onNavigate,
    filterText = "",
    onFilterChange,
    viewMode = "list",
    onViewModeChange,
    onUploadClick,
    onRefresh,
    chatTitleMap = {},
    isMobile = false,
    showMobileFolders = false,
    onToggleMobileFolders,
}) {
    const { t } = useTranslation();
    const currentCrumb = breadcrumbs[breadcrumbs.length - 1];
    const currentLabel = currentCrumb
        ? currentCrumb.path === ""
            ? t("All Files")
            : getBreadcrumbLabel(currentCrumb.label, chatTitleMap, t)
        : t("All Files");

    if (isMobile) {
        return (
            <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50/50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/50">
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        type="button"
                        onClick={onToggleMobileFolders}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        <Folder className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                        <span className="min-w-0 truncate font-medium">
                            {currentLabel}
                        </span>
                        {showMobileFolders ? (
                            <ChevronUp className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        )}
                    </button>

                    {onUploadClick && (
                        <button
                            onClick={onUploadClick}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                            title={t("Upload")}
                            type="button"
                        >
                            <Upload className="w-4 h-4 text-gray-500" />
                        </button>
                    )}

                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                            title={t("Refresh")}
                            type="button"
                        >
                            <RefreshCw className="w-4 h-4 text-gray-500" />
                        </button>
                    )}
                </div>

                <FilterInput
                    value={filterText}
                    onChange={onFilterChange}
                    onClear={() => onFilterChange("")}
                    placeholder={t("Filter files...")}
                    className="h-9 text-sm"
                />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 min-w-0 flex-shrink-0">
            <nav className="flex items-center gap-0.5 min-w-0 flex-shrink overflow-hidden text-sm">
                {breadcrumbs.map((crumb, idx) => (
                    <span
                        key={crumb.path}
                        className="flex items-center gap-0.5 min-w-0"
                    >
                        {idx > 0 && (
                            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        )}
                        {idx < breadcrumbs.length - 1 ? (
                            <button
                                onClick={() => onNavigate(crumb.path)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 truncate max-w-[120px] transition-colors"
                                title={
                                    crumb.path === ""
                                        ? t("All Files")
                                        : getBreadcrumbLabel(
                                              crumb.label,
                                              chatTitleMap,
                                              t,
                                          )
                                }
                            >
                                {crumb.path === ""
                                    ? t("All Files")
                                    : getBreadcrumbLabel(
                                          crumb.label,
                                          chatTitleMap,
                                          t,
                                      )}
                            </button>
                        ) : (
                            <span
                                className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[160px]"
                                title={
                                    crumb.path === ""
                                        ? t("All Files")
                                        : getBreadcrumbLabel(
                                              crumb.label,
                                              chatTitleMap,
                                              t,
                                          )
                                }
                            >
                                {crumb.path === ""
                                    ? t("All Files")
                                    : getBreadcrumbLabel(
                                          crumb.label,
                                          chatTitleMap,
                                          t,
                                      )}
                            </span>
                        )}
                    </span>
                ))}
            </nav>

            <div className="flex-1 min-w-0" />

            <div className="w-40 sm:w-48 flex-shrink-0">
                <FilterInput
                    value={filterText}
                    onChange={onFilterChange}
                    onClear={() => onFilterChange("")}
                    placeholder={t("Filter files...")}
                    className="h-7 text-xs"
                />
            </div>

            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden flex-shrink-0">
                <button
                    onClick={() => onViewModeChange("list")}
                    className={`p-1 transition-colors ${
                        viewMode === "list"
                            ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                    title={t("List view")}
                >
                    <List className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => onViewModeChange("grid")}
                    className={`p-1 transition-colors ${
                        viewMode === "grid"
                            ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                    title={t("Grid view")}
                >
                    <LayoutGrid className="w-3.5 h-3.5" />
                </button>
            </div>

            {onUploadClick && (
                <button
                    onClick={onUploadClick}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors flex-shrink-0"
                    title={t("Upload")}
                >
                    <Upload className="w-4 h-4 text-gray-500" />
                </button>
            )}

            {onRefresh && (
                <button
                    onClick={onRefresh}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors flex-shrink-0"
                    title={t("Refresh")}
                >
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                </button>
            )}
        </div>
    );
}
