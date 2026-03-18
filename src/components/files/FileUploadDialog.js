import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { UploadIcon, Loader2Icon } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AuthContext, ServerContext } from "@/src/App";
import config from "../../../config";
import { ACCEPTED_FILE_TYPES } from "../../../src/utils/mediaUtils";
import { uploadFileToMediaHelper } from "../../../src/utils/fileUploadUtils";
import {
    createChatStorageTarget,
    createUserGlobalStorageTarget,
} from "../../../src/utils/storageTargets";

// Shared FileUploadDialog component
export default function FileUploadDialog({
    isOpen,
    onClose,
    onFileUpload,
    uploadEndpoint,
    chatId = null,
    contextId: contextIdProp = null,
    storageTarget = null,
    title = "Upload Files",
    description = "Upload files to use in chat and media. Supported formats include images, documents, and media files.",
}) {
    const { t } = useTranslation();
    const isRtl = i18next.language === "ar";
    const { serverUrl } = useContext(ServerContext);
    const { user } = useContext(AuthContext);

    const contextId = contextIdProp || user?.contextId || null;
    const [fileUploading, setFileUploading] = useState(false);
    const [fileUploadError, setFileUploadError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileUpload = async (event) => {
        setFileUploading(true);
        setFileUploadError(null);
        setUploadProgress(0);

        const file = event.target.files[0];
        if (!file) {
            setFileUploading(false);
            return;
        }

        // Check if file type is supported
        const isSupported = ACCEPTED_FILE_TYPES.some((type) => {
            // Check MIME type
            if (file.type === type) return true;
            // Check file extension
            const fileExtension =
                "." + file.name.split(".").pop().toLowerCase();
            return type.includes(fileExtension) || type.endsWith(fileExtension);
        });

        if (!isSupported) {
            setFileUploading(false);
            setFileUploadError({
                message: t(
                    "Unsupported file type. Please upload a supported file.",
                ),
            });
            return;
        }

        try {
            // Use XMLHttpRequest for endpoint-backed uploads so progress is available
            if (uploadEndpoint) {
                const formData = new FormData();
                formData.append("file", file);

                // Use XMLHttpRequest for proper progress tracking
                const xhr = new XMLHttpRequest();
                xhr.open("POST", uploadEndpoint, true);

                // Monitor upload progress
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentage = Math.round(
                            (event.loaded * 100) / event.total,
                        );
                        setUploadProgress(percentage);
                    }
                };

                // Handle upload response
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            onFileUpload(data);
                            setFileUploading(false);
                            onClose();
                        } catch (e) {
                            console.error("Error parsing response:", e);
                            setFileUploadError({
                                message: t(
                                    "File upload failed: Invalid response",
                                ),
                            });
                            setFileUploading(false);
                        }
                    } else {
                        console.error(xhr.statusText);
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            setFileUploadError({
                                message:
                                    errorData.error ||
                                    `${t("File upload failed, response:")} ${xhr.statusText}`,
                            });
                        } catch {
                            setFileUploadError({
                                message: `${t("File upload failed, response:")} ${xhr.statusText}`,
                            });
                        }
                        setFileUploading(false);
                    }
                };

                // Handle upload errors
                xhr.onerror = (error) => {
                    console.error(error);
                    setFileUploadError({ message: t("File upload failed") });
                    setFileUploading(false);
                };

                // Send the file
                xhr.send(formData);
            } else {
                // Upload file directly to media helper using shared utility
                try {
                    const directUploadTarget =
                        storageTarget ||
                        (chatId && contextId
                            ? createChatStorageTarget(contextId, chatId)
                            : contextId
                              ? createUserGlobalStorageTarget(contextId)
                              : null);
                    const data = await uploadFileToMediaHelper(file, {
                        storageTarget: directUploadTarget,
                        contextId,
                        onProgress: setUploadProgress,
                        serverUrl: config.endpoints.mediaHelper(serverUrl),
                    });

                    onFileUpload({
                        url: data.url,
                        displayFilename: data.displayFilename,
                        converted: data.converted,
                        filename: data.filename,
                        blobPath: data.blobPath,
                    });
                    setFileUploading(false);
                    onClose();
                } catch (error) {
                    console.error("File upload error:", error);
                    setFileUploadError({
                        message:
                            error.message ||
                            t("File upload failed. Please try again."),
                    });
                    setFileUploading(false);
                }
            }
        } catch (error) {
            console.error("File upload error:", error);
            setFileUploadError({
                message: t("File upload failed. Please try again."),
            });
            setFileUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader className={isRtl ? "text-right" : ""}>
                    <DialogTitle>{t(title)}</DialogTitle>
                    <DialogDescription>{t(description)}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {fileUploading ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-8">
                            <div
                                className={`flex items-center gap-2 text-sm text-gray-500 ${isRtl ? "flex-row-reverse" : ""}`}
                            >
                                <Loader2Icon className="w-4 h-4 animate-spin" />
                                <span>
                                    {t("Uploading file...")}{" "}
                                    {Math.round(uploadProgress)}%
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div
                                className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                                dir={isRtl ? "rtl" : "ltr"}
                            >
                                <div
                                    className="h-full bg-sky-500 dark:bg-sky-400 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center w-full">
                            <div className="flex flex-col gap-4">
                                <div
                                    className={`border-2 border-dashed border-gray-300 rounded-lg p-8 w-full max-w-xl hover:border-primary-500 transition-colors ${isRtl ? "text-right" : ""}`}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.add(
                                            "border-primary-500",
                                        );
                                    }}
                                    onDragLeave={(e) => {
                                        e.currentTarget.classList.remove(
                                            "border-primary-500",
                                        );
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove(
                                            "border-primary-500",
                                        );
                                        const file = e.dataTransfer.files[0];
                                        const event = {
                                            target: { files: [file] },
                                        };
                                        handleFileUpload(event);
                                    }}
                                >
                                    <div
                                        className={`text-center max-w-96 ${isRtl ? "text-right" : ""}`}
                                    >
                                        <label
                                            className={`lb-outline-secondary text-sm flex gap-2 items-center cursor-pointer justify-center w-64 mx-auto mb-3 ${isRtl ? "flex-row-reverse" : ""}`}
                                        >
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept={ACCEPTED_FILE_TYPES.join(
                                                    ",",
                                                )}
                                                onChange={handleFileUpload}
                                                disabled={fileUploading}
                                            />
                                            <UploadIcon className="w-4 h-4" />
                                            {t("Choose a file")}
                                        </label>
                                        <p className="text-sm text-gray-500 mb-2">
                                            {t("or drag and drop here")}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {t("Supported formats")}:{" "}
                                            {t(
                                                "Documents, Images, Videos, Audio",
                                            )}
                                            <br />
                                            {t("Maximum file size")}:{" "}
                                            {t("50MB")}
                                        </p>
                                    </div>
                                </div>
                                {fileUploadError && (
                                    <p
                                        className={`text-red-600 dark:text-red-400 text-sm mt-2 ${isRtl ? "text-right" : "text-center"}`}
                                    >
                                        {fileUploadError.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
