"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatFileSize } from "../FileManager";

export default function FileStatusBar({
    fileCount = 0,
    totalFileCount = 0,
    selectedCount = 0,
    files = [],
    selectedPath = "",
}) {
    const { t } = useTranslation();

    const totalSize = useMemo(() => {
        return files.reduce((sum, file) => sum + (file?.size || 0), 0);
    }, [files]);

    return (
        <div className="flex items-center gap-4 px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-[11px] text-gray-500 dark:text-gray-400 flex-shrink-0">
            <span>
                {fileCount} {fileCount === 1 ? t("file") : t("files")}
                {selectedPath !== "" &&
                    totalFileCount !== fileCount &&
                    ` (${totalFileCount} ${t("total")})`}
            </span>
            {selectedCount > 0 && (
                <span className="text-sky-600 dark:text-sky-400">
                    {selectedCount} {t("selected")}
                </span>
            )}
            {totalSize > 0 && (
                <span className="ml-auto tabular-nums">
                    {formatFileSize(totalSize)}
                </span>
            )}
        </div>
    );
}
