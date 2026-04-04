import { useCallback, useContext } from "react";
import { uploadFileToMediaHelper } from "../../../utils/fileUploadUtils";
import { createMediaStorageTarget } from "../../../utils/storageTargets";
import { AuthContext } from "../../../App";

export const useFileUpload = ({
    createMediaItem,
    settings,
    t,
    promptRef,
    setSelectedImages,
    setSelectedImagesObjects,
}) => {
    const { user } = useContext(AuthContext);
    // Use default user contextId (not :chat, so they don't appear in chat file collections)
    const contextId = user?.contextId;
    const handleFileUpload = useCallback(
        async (file) => {
            if (!file) return;

            const serverUrl = "/media-helper";

            try {
                // Upload file using shared utility
                const data = await uploadFileToMediaHelper(file, {
                    storageTarget: createMediaStorageTarget(contextId),
                    serverUrl,
                });

                if (data?.url) {
                    // Create media item in database
                    const mediaItemData = {
                        taskId: `upload-${Date.now()}`,
                        cortexRequestId: `upload-${Date.now()}`,
                        prompt: t("Uploaded image"),
                        type: "image",
                        model: "upload",
                        status: "completed",
                        settings: settings,
                    };

                    // Only add URLs if they exist
                    if (data.url) {
                        mediaItemData.url = data.url;
                    }
                    if (data.blobPath) {
                        mediaItemData.blobPath = data.blobPath;
                    }
                    if (data.filename) {
                        mediaItemData.filename = data.filename;
                    }

                    const mediaItem =
                        await createMediaItem.mutateAsync(mediaItemData);

                    setSelectedImages(new Set([mediaItem.cortexRequestId]));
                    setSelectedImagesObjects([mediaItem]);
                    setTimeout(() => {
                        promptRef.current && promptRef.current.focus();
                    }, 0);
                }
            } catch (error) {
                console.error("Error uploading file:", error);
            }
        },
        [
            t,
            createMediaItem,
            settings,
            promptRef,
            setSelectedImages,
            setSelectedImagesObjects,
            contextId,
        ],
    );

    const handleFileSelect = useCallback(
        (event) => {
            const file = event.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        },
        [handleFileUpload],
    );

    return {
        handleFileUpload,
        handleFileSelect,
    };
};
