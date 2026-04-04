"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGetActiveChats } from "../../../app/queries/chats";
import { purgeFiles } from "./chatFileUtils";
import FileUploadDialog from "./FileUploadDialog";
import UnifiedFileManager from "../common/UnifiedFileManager";
import {
    checkDownloadLimits,
    downloadFilesAsZip,
    downloadSingleFile,
    getFilename,
} from "../../utils/fileDownloadUtils";
import {
    buildMediaHelperFileParams,
    createChatStorageTarget,
    createUserGlobalStorageTarget,
    inferStorageTargetFromFile,
} from "../../utils/storageTargets";
import { toast } from "react-toastify";

export default function UserFileCollection({
    contextId,
    contextKey,
    chatId = null,
    messages = [],
    updateChatHook = null,
    containerHeight = "60vh",
}) {
    const { t } = useTranslation();
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);

    const defaultUploadTarget = useMemo(() => {
        if (!contextId) return null;
        return chatId
            ? createChatStorageTarget(contextId, chatId)
            : createUserGlobalStorageTarget(contextId);
    }, [contextId, chatId]);

    const { data: activeChats } = useGetActiveChats();
    const chatTitleMap = useMemo(() => {
        const map = {};
        if (Array.isArray(activeChats)) {
            for (const chat of activeChats) {
                if (chat?._id && chat?.title) {
                    map[String(chat._id)] = chat.title;
                }
            }
        }
        return map;
    }, [activeChats]);

    const handleDelete = useCallback(
        async (filesToRemove) => {
            const validFiles = (
                Array.isArray(filesToRemove) ? filesToRemove : [filesToRemove]
            )
                .filter((file) => typeof file === "object")
                .map((file) => ({
                    ...file,
                    type: file.type || (file.image_url ? "image_url" : "file"),
                }))
                .filter(
                    (file) => file.type === "image_url" || file.type === "file",
                );

            if (validFiles.length === 0) return;

            await purgeFiles({
                fileObjs: validFiles,
                contextId,
                contextKey,
                chatId,
                messages,
                updateChatHook,
                t,
                getFilename,
                skipCloudDelete: false,
                skipUserFileCollection: true,
            });

            setReloadToken((value) => value + 1);
        },
        [contextId, contextKey, chatId, messages, updateChatHook, t],
    );

    const handleDownload = useCallback(
        async (selectedFiles) => {
            if (!selectedFiles || selectedFiles.length === 0) return;

            const limitCheck = checkDownloadLimits(selectedFiles, {
                maxFiles: 100,
                maxTotalSizeMB: 1000,
            });

            if (!limitCheck.allowed) {
                const errorMessage = limitCheck.errorKey
                    ? t(limitCheck.errorKey)
                    : limitCheck.error;
                const detailMessage = limitCheck.detailsKey
                    ? t(limitCheck.detailsKey, limitCheck.detailsParams || {})
                    : limitCheck.details;
                toast.error(`${errorMessage}: ${detailMessage}`);
                return;
            }

            if (selectedFiles.length === 1) {
                const file = selectedFiles[0];
                const url = file?.url;
                if (url) {
                    await downloadSingleFile(url, getFilename(file) || "");
                }
                return;
            }

            await downloadFilesAsZip(selectedFiles, {
                filenamePrefix: "chat_file_download",
                onProgress: (loading) => {
                    setIsDownloading(loading);
                },
                onError: (error) => {
                    toast.error(
                        t("Failed to download files: {{error}}", {
                            error: error.message,
                        }),
                    );
                },
            });
        },
        [t],
    );

    const handleUpdateMetadata = useCallback(
        async (file, metadata) => {
            if (!metadata?.displayFilename) return;

            const storageTarget =
                inferStorageTargetFromFile(file, contextId) ||
                defaultUploadTarget;
            const routingParams = buildMediaHelperFileParams({ storageTarget });
            const response = await fetch("/api/files/rename", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...routingParams,
                    blobPath: file?.blobPath || undefined,
                    filename: file?.filename || undefined,
                    newFilename: metadata.displayFilename,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || response.statusText);
            }

            setReloadToken((value) => value + 1);
        },
        [contextId, defaultUploadTarget],
    );

    const handleUploadComplete = useCallback(() => {
        setReloadToken((value) => value + 1);
    }, []);

    return (
        <>
            <UnifiedFileManager
                contextId={contextId}
                chatId={chatId}
                chatTitleMap={chatTitleMap}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onUpdateMetadata={handleUpdateMetadata}
                onUploadClick={() => setShowUploadDialog(true)}
                isDownloading={isDownloading}
                containerHeight={containerHeight}
                reloadToken={reloadToken}
            />

            <FileUploadDialog
                isOpen={showUploadDialog}
                onClose={() => setShowUploadDialog(false)}
                onFileUpload={handleUploadComplete}
                contextId={contextId}
                chatId={chatId}
                storageTarget={defaultUploadTarget}
                title="Upload Files"
                description="Upload files to add them to this conversation."
            />
        </>
    );
}
