import { Modal } from "@/components/ui/modal";
import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { User, X, Sparkles, Bell, BellOff } from "lucide-react";
import { useUpdateAiOptions } from "../../app/queries/options";
import { useUpdateCurrentUser } from "../../app/queries/users";
import { AuthContext } from "../App";
import { LanguageContext } from "../contexts/LanguageProvider";
import { useOnboarding } from "../contexts/OnboardingContext";
import { useEntities } from "../hooks/useEntities";
import axios from "../../app/utils/axios-client";
import { AGENT_MODEL_OPTIONS } from "../../app/utils/agent-model-mapping";
import usePushNotifications from "../hooks/usePushNotifications";

const UserOptions = ({ show, handleClose }) => {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const { direction } = useContext(LanguageContext);
    const { openOnboarding } = useOnboarding();
    const isRTL = direction === "rtl";
    const profilePictureInputRef = useRef();

    // Push notifications
    const { registerForPush } = usePushNotifications({ enabled: false });
    const [notificationStatus, setNotificationStatus] = useState("unknown");
    const [isEnablingNotifications, setIsEnablingNotifications] =
        useState(false);

    // Check notification status when modal opens
    useEffect(() => {
        if (show && typeof window !== "undefined") {
            const checkStatus = () => {
                if (!("Notification" in window) || !("PushManager" in window)) {
                    setNotificationStatus("unsupported");
                } else if (Notification.permission === "granted") {
                    setNotificationStatus("enabled");
                } else if (Notification.permission === "denied") {
                    setNotificationStatus("denied");
                } else {
                    setNotificationStatus("default");
                }
            };
            checkStatus();
        }
    }, [show]);

    const handleEnableNotifications = async () => {
        setIsEnablingNotifications(true);
        try {
            // userGesture: true is required for iOS to show the permission prompt
            await registerForPush({ userGesture: true });
        } catch (error) {
            // Silent fail - UI will show appropriate state
        } finally {
            // Always re-check status after attempting, even if there was an error
            // Permission might have been granted even if subscription save failed
            if (Notification.permission === "granted") {
                setNotificationStatus("enabled");
            } else if (Notification.permission === "denied") {
                setNotificationStatus("denied");
            }
            setIsEnablingNotifications(false);
        }
    };

    const { entities } = useEntities(user?.contextId);

    // Filter to only show user-created entities (non-system, non-default)
    const userEntities = entities.filter((e) => !e.isSystem);

    const [profilePicture, setProfilePicture] = useState(
        user?.profilePicture || null,
    );
    const [selectedDefaultEntityId, setSelectedDefaultEntityId] = useState(
        user?.defaultEntityId || "",
    );
    const [agentModel, setAgentModel] = useState(user.agentModel || "");
    const [uploadingProfilePicture, setUploadingProfilePicture] =
        useState(false);
    const [error, setError] = useState("");

    const updateAiOptionsMutation = useUpdateAiOptions();
    const updateCurrentUserMutation = useUpdateCurrentUser();

    // Get the name of the currently selected default entity
    const selectedEntity = userEntities.find(
        (e) => e.id === selectedDefaultEntityId,
    );
    const aiName = selectedEntity?.name || user?.aiName || "Enntity";

    // Only sync state when the modal opens, not on every user change
    // This prevents the selection from being overwritten during save
    useEffect(() => {
        if (show && user) {
            setProfilePicture(user.profilePicture || null);
            setSelectedDefaultEntityId(user.defaultEntityId || "");
            setAgentModel(user.agentModel || "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const handleProfilePictureSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError(t("Please select an image file"));
            if (profilePictureInputRef.current) {
                profilePictureInputRef.current.value = "";
            }
            return;
        }

        setUploadingProfilePicture(true);
        setError("");

        try {
            const previewUrl = URL.createObjectURL(file);
            setProfilePicture(previewUrl);

            const formData = new FormData();
            formData.append("file", file);

            const response = await axios.post(
                "/api/users/me/profile-picture",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                },
            );

            if (response.data?.url) {
                setProfilePicture(response.data.url);
                await updateCurrentUserMutation.mutateAsync({
                    data: { profilePicture: response.data.url },
                });
            } else {
                throw new Error(t("Upload failed: No URL returned"));
            }
        } catch (error) {
            console.error("Error uploading profile picture:", error);
            setError(
                error.response?.data?.error ||
                    error.message ||
                    t("Failed to upload profile picture"),
            );
            setProfilePicture(user?.profilePicture || null);
            if (profilePictureInputRef.current) {
                profilePictureInputRef.current.value = "";
            }
        } finally {
            setUploadingProfilePicture(false);
        }
    };

    const handleRemoveProfilePicture = () => {
        // Optimistic update - immediately remove from UI
        const oldProfilePicture = profilePicture;
        setProfilePicture(null);
        if (profilePictureInputRef.current) {
            profilePictureInputRef.current.value = "";
        }

        // Fire delete async
        (async () => {
            try {
                await axios.delete("/api/users/me/profile-picture");
                await updateCurrentUserMutation.mutateAsync({
                    data: { profilePicture: "" },
                });
            } catch (error) {
                console.error("Error removing profile picture:", error);
                // Restore on failure
                setProfilePicture(oldProfilePicture);
                setError(
                    error.response?.data?.error ||
                        error.message ||
                        t("Failed to remove profile picture"),
                );
            }
        })();
    };

    const saveOptions = async (updates) => {
        if (!user?.userId) {
            console.error("UserId not found");
            return;
        }

        try {
            await updateAiOptionsMutation.mutateAsync({
                userId: user.userId,
                contextId: user.contextId,
                aiName: updates.aiName ?? aiName,
                agentModel: updates.agentModel ?? agentModel,
                defaultEntityId:
                    updates.defaultEntityId ?? selectedDefaultEntityId,
            });
            setError("");
        } catch (error) {
            console.error("Error saving options:", error);
            setError(
                error.response?.data?.error ||
                    error.message ||
                    t("Failed to save options"),
            );
        }
    };

    const handleDefaultEntityChange = (entityId) => {
        setSelectedDefaultEntityId(entityId);
        const entity = userEntities.find((e) => e.id === entityId);
        // Save both the entity ID and derive the name from the entity
        saveOptions({
            defaultEntityId: entityId,
            aiName: entity?.name || "Enntity",
        });
    };

    return (
        <Modal
            widthClassName="max-w-2xl"
            title={t("Options")}
            show={show}
            onHide={handleClose}
        >
            {
                <div className="flex flex-col gap-4">
                    {error && (
                        <div
                            className={`text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded ${isRTL ? "text-right" : "text-left"}`}
                            dir={direction}
                        >
                            {error}
                        </div>
                    )}

                    {/* Profile Picture Section */}
                    <section>
                        <div
                            className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse justify-end" : ""}`}
                        >
                            {isRTL ? (
                                <>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                profilePictureInputRef.current?.click()
                                            }
                                            disabled={uploadingProfilePicture}
                                            className="lb-outline-secondary text-xs px-2 py-1"
                                        >
                                            {uploadingProfilePicture
                                                ? t("Uploading...")
                                                : profilePicture
                                                  ? t("Change")
                                                  : t("Upload")}
                                        </button>
                                        <input
                                            ref={profilePictureInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={
                                                handleProfilePictureSelect
                                            }
                                            className="hidden"
                                        />
                                    </div>
                                    <div className="relative flex-shrink-0">
                                        {profilePicture ? (
                                            <img
                                                src={profilePicture}
                                                alt={t("Profile picture")}
                                                className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-gray-300 dark:border-gray-600">
                                                <User className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                            </div>
                                        )}
                                        {profilePicture && (
                                            <button
                                                type="button"
                                                onClick={
                                                    handleRemoveProfilePicture
                                                }
                                                className="absolute -top-0.5 -start-0.5 w-4 h-4 rounded-full bg-gray-500 dark:bg-gray-600 text-white flex items-center justify-center hover:bg-red-500 dark:hover:bg-red-500 transition-colors"
                                                title={t(
                                                    "Remove profile picture",
                                                )}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative flex-shrink-0">
                                        {profilePicture ? (
                                            <img
                                                src={profilePicture}
                                                alt={t("Profile picture")}
                                                className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border border-gray-300 dark:border-gray-600">
                                                <User className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                            </div>
                                        )}
                                        {profilePicture && (
                                            <button
                                                type="button"
                                                onClick={
                                                    handleRemoveProfilePicture
                                                }
                                                className="absolute -top-0.5 -end-0.5 w-4 h-4 rounded-full bg-gray-500 dark:bg-gray-600 text-white flex items-center justify-center hover:bg-red-500 dark:hover:bg-red-500 transition-colors"
                                                title={t(
                                                    "Remove profile picture",
                                                )}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                profilePictureInputRef.current?.click()
                                            }
                                            disabled={uploadingProfilePicture}
                                            className="lb-outline-secondary text-xs px-2 py-1"
                                        >
                                            {uploadingProfilePicture
                                                ? t("Uploading...")
                                                : profilePicture
                                                  ? t("Change")
                                                  : t("Upload")}
                                        </button>
                                        <input
                                            ref={profilePictureInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={
                                                handleProfilePictureSelect
                                            }
                                            className="hidden"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* Separator */}
                    <hr className="border-gray-200 dark:border-gray-700" />

                    {/* AI Settings Section */}
                    <section className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label
                                    className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ${isRTL ? "text-right" : "text-left"}`}
                                    htmlFor="defaultEntity"
                                >
                                    {t("Default AI")}
                                </label>
                                <select
                                    id="defaultEntity"
                                    value={selectedDefaultEntityId}
                                    onChange={(e) =>
                                        handleDefaultEntityChange(
                                            e.target.value,
                                        )
                                    }
                                    className="lb-input w-full text-sm"
                                    dir={direction}
                                >
                                    <option value="">
                                        {t("Select default AI...")}
                                    </option>
                                    {userEntities.map((entity) => (
                                        <option
                                            key={entity.id}
                                            value={entity.id}
                                        >
                                            {entity.name}
                                        </option>
                                    ))}
                                </select>
                                {userEntities.length === 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t(
                                            "Meet an AI to set them as your default",
                                        )}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ${isRTL ? "text-right" : "text-left"}`}
                                    htmlFor="agentModel"
                                >
                                    {t("Model Override")}
                                </label>
                                <select
                                    id="agentModel"
                                    value={agentModel}
                                    onChange={(e) => {
                                        setAgentModel(e.target.value);
                                        saveOptions({
                                            agentModel: e.target.value,
                                        });
                                    }}
                                    className="lb-input w-full text-sm"
                                    dir={direction}
                                >
                                    <option value="">
                                        {t("Use entity preferred model")}
                                    </option>
                                    {AGENT_MODEL_OPTIONS.map((option) => (
                                        <option
                                            key={option.modelId}
                                            value={option.modelId}
                                        >
                                            {t(option.displayName)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Meet a New AI Button */}
                        <button
                            type="button"
                            onClick={() => {
                                handleClose();
                                openOnboarding();
                            }}
                            className="lb-outline-secondary text-sm w-full sm:w-auto flex items-center justify-center gap-2 mt-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            {t("Meet a New AI")}
                        </button>
                    </section>

                    {/* Separator */}
                    <hr className="border-gray-200 dark:border-gray-700" />

                    {/* Notifications Section */}
                    <section className="space-y-2">
                        <label
                            className={`block text-xs font-medium text-gray-700 dark:text-gray-300 ${isRTL ? "text-right" : "text-left"}`}
                        >
                            {t("Notifications")}
                        </label>
                        {notificationStatus === "unsupported" ? (
                            <p className="text-xs text-gray-500">
                                {t(
                                    "Push notifications are not supported in this browser.",
                                )}
                            </p>
                        ) : notificationStatus === "enabled" ? (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                <Bell className="w-4 h-4" />
                                {t("Notifications enabled")}
                            </div>
                        ) : notificationStatus === "denied" ? (
                            <div className="flex items-center gap-2 text-sm text-red-500">
                                <BellOff className="w-4 h-4" />
                                <span>
                                    {t(
                                        "Notifications blocked. Please enable in browser settings.",
                                    )}
                                </span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleEnableNotifications}
                                disabled={isEnablingNotifications}
                                className="lb-outline-secondary text-sm w-full sm:w-auto flex items-center justify-center gap-2"
                            >
                                <Bell className="w-4 h-4" />
                                {isEnablingNotifications
                                    ? t("Enabling...")
                                    : t("Enable Notifications")}
                            </button>
                        )}
                    </section>

                    {/* Footer */}
                    <div
                        className={`flex gap-2 pt-3 mt-3 border-t border-gray-200 dark:border-gray-700 ${isRTL ? "flex-row-reverse justify-start" : "justify-end"}`}
                    >
                        <button
                            type="button"
                            className="lb-outline-secondary text-xs flex-1 sm:flex-initial"
                            onClick={handleClose}
                        >
                            {t("Done")}
                        </button>
                    </div>
                </div>
            }
        </Modal>
    );
};

export default UserOptions;
