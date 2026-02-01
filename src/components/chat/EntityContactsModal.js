"use client";

import React, { useState, useMemo, useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Search,
    Sparkles,
    Clock,
    ChevronRight,
    Users,
    Trash2,
    MessageCircle,
    Settings,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import EntityIcon from "./EntityIcon";
import EntityOptionsDialog from "./EntityOptionsDialog";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { useGetChats, useAddChat } from "../../../app/queries/chats";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../App";
import ContinuityMemoryEditor from "../ContinuityMemoryEditor";
import ToolsEditor from "./ToolsEditor";
import VoiceEditor from "./VoiceEditor";

// Sort options
const SORT_OPTIONS = {
    NAME_ASC: "name_asc",
    NAME_DESC: "name_desc",
    RECENT: "recent",
};

export default function EntityContactsModal({
    isOpen,
    onClose,
    entities,
    selectedEntityId,
    onEntitySelect,
    refetchEntities,
}) {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const { openOnboarding } = useOnboarding();
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState(SORT_OPTIONS.NAME_ASC);
    const [entityToDelete, setEntityToDelete] = useState(null);
    const [deletedEntityIds, setDeletedEntityIds] = useState(new Set());
    const [memoryEditorEntityId, setMemoryEditorEntityId] = useState(null);
    const [memoryEditorEntityName, setMemoryEditorEntityName] = useState(null);
    const [toolsEditorEntityId, setToolsEditorEntityId] = useState(null);
    const [toolsEditorEntityName, setToolsEditorEntityName] = useState(null);
    const [toolsEditorEntityTools, setToolsEditorEntityTools] = useState([]);
    const [voiceEditorEntityId, setVoiceEditorEntityId] = useState(null);
    const [voiceEditorEntityName, setVoiceEditorEntityName] = useState(null);
    const [voiceEditorCurrentVoice, setVoiceEditorCurrentVoice] =
        useState(null);
    const [optionsEntity, setOptionsEntity] = useState(null);
    const pendingOptionsEntityRef = useRef(null);
    const firstEntityRef = useRef(null);

    // Aggressively refetch entities when modal opens to get fresh avatars
    useEffect(() => {
        if (isOpen && refetchEntities) {
            refetchEntities();
        }
    }, [isOpen, refetchEntities]);

    const { data: chatsData } = useGetChats();
    const addChat = useAddChat();

    // Flatten chats from infinite query pages
    const allChats = useMemo(() => {
        if (!chatsData?.pages) return [];
        return chatsData.pages.flat();
    }, [chatsData?.pages]);

    // Filter and sort entities
    const filteredEntities = useMemo(() => {
        let filtered = entities.filter((entity) => {
            // Filter out system entities from the contacts list
            if (entity.isSystem) return false;

            // Filter out optimistically deleted entities
            if (deletedEntityIds.has(entity.id)) return false;

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    entity.name?.toLowerCase().includes(query) ||
                    entity.description?.toLowerCase().includes(query)
                );
            }
            return true;
        });

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case SORT_OPTIONS.NAME_DESC:
                    return (b.name || "").localeCompare(a.name || "");
                case SORT_OPTIONS.RECENT:
                    // Sort by updatedAt if available, otherwise createdAt
                    const aTime = a.updatedAt || a.createdAt || "";
                    const bTime = b.updatedAt || b.createdAt || "";
                    return bTime.localeCompare(aTime);
                case SORT_OPTIONS.NAME_ASC:
                default:
                    return (a.name || "").localeCompare(b.name || "");
            }
        });

        return filtered;
    }, [entities, searchQuery, sortBy, deletedEntityIds]);

    // Focus first entity when modal opens (better mobile UX than focusing search)
    useEffect(() => {
        if (isOpen && firstEntityRef.current) {
            // Small delay to ensure dialog is fully rendered
            const timer = setTimeout(() => {
                firstEntityRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Find last chat with a specific entity
    const findLastChatWithEntity = (entityId) => {
        if (!allChats.length) return null;

        // Find the most recent chat with this entity
        const entityChats = allChats.filter(
            (chat) => chat.selectedEntityId === entityId,
        );
        if (entityChats.length === 0) return null;

        // Sort by updatedAt descending and return the first one
        return entityChats.sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt || 0);
            const bTime = new Date(b.updatedAt || b.createdAt || 0);
            return bTime - aTime;
        })[0];
    };

    const handleEntityClick = async (entityId) => {
        // Find the last chat with this entity
        const lastChat = findLastChatWithEntity(entityId);

        if (lastChat) {
            // Navigate to existing chat
            onClose();
            router.push(`/chat/${lastChat._id}`);
        } else {
            // Create a new chat with this entity
            try {
                const entity = entities.find((e) => e.id === entityId);
                const newChat = await addChat.mutateAsync({
                    messages: [],
                    selectedEntityId: entityId,
                    selectedEntityName: entity?.name || "",
                    forceNew: true,
                });
                onClose();
                router.push(`/chat/${newChat._id}`);
            } catch (error) {
                console.error("Failed to create chat:", error);
                // Fallback to just selecting the entity
                onEntitySelect(entityId);
                onClose();
            }
        }
    };

    const handleMeetNewAI = () => {
        onClose();
        openOnboarding();
    };

    const handleDeleteClick = (e, entity) => {
        e.stopPropagation();
        setEntityToDelete(entity);
    };

    const handleConfirmDelete = async () => {
        if (!entityToDelete || !user?.contextId) return;

        const entityIdToDelete = entityToDelete.id;

        // Optimistically remove from list and close dialog
        setDeletedEntityIds((prev) => new Set([...prev, entityIdToDelete]));
        setEntityToDelete(null);

        // Delete in background - don't await
        fetch(`/api/entities/${entityIdToDelete}`, {
            method: "DELETE",
        })
            .then((response) => response.json())
            .then((result) => {
                if (!result.success) {
                    console.error("Failed to remove contact:", result.error);
                    // Restore on failure
                    setDeletedEntityIds((prev) => {
                        const next = new Set(prev);
                        next.delete(entityIdToDelete);
                        return next;
                    });
                }
            })
            .catch((error) => {
                console.error("Failed to remove contact:", error);
                // Restore on error
                setDeletedEntityIds((prev) => {
                    const next = new Set(prev);
                    next.delete(entityIdToDelete);
                    return next;
                });
            });
    };

    // Format relative time
    const formatRelativeTime = (dateString) => {
        if (!dateString) return null;

        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t("Just now");
        if (diffMins < 60) return t("{{count}} min ago", { count: diffMins });
        if (diffHours < 24) return t("{{count}}h ago", { count: diffHours });
        if (diffDays < 7) return t("{{count}}d ago", { count: diffDays });

        return date.toLocaleDateString();
    };

    // Get last chat info for an entity
    const getLastChatInfo = (entityId) => {
        const lastChat = findLastChatWithEntity(entityId);
        if (!lastChat) return null;
        return {
            hasChat: true,
            lastChatTime: lastChat.updatedAt || lastChat.createdAt,
        };
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent
                    className="sm:max-w-md max-h-[80vh] flex flex-col"
                    onOpenAutoFocus={(event) => {
                        // Prevent auto-focusing the search input to avoid mobile keyboard pop
                        event.preventDefault();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            {t("Your AI Contacts")}
                        </DialogTitle>
                        <DialogDescription>
                            {t("Select an AI to chat with or meet someone new")}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Search and Sort */}
                    <div className="flex gap-2 mt-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t("Search contacts...")}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-base md:text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            />
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3 py-2 text-base md:text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        >
                            <option value={SORT_OPTIONS.NAME_ASC}>
                                {t("A-Z")}
                            </option>
                            <option value={SORT_OPTIONS.NAME_DESC}>
                                {t("Z-A")}
                            </option>
                            <option value={SORT_OPTIONS.RECENT}>
                                {t("Recent")}
                            </option>
                        </select>
                    </div>

                    {/* Entity List */}
                    <div className="flex-1 overflow-y-auto mt-3 -mx-2 px-2 min-h-0">
                        <div className="space-y-1">
                            {filteredEntities.map((entity, index) => {
                                const chatInfo = getLastChatInfo(entity.id);
                                const isFirst = index === 0;
                                return (
                                    <div
                                        key={entity.id}
                                        ref={isFirst ? firstEntityRef : null}
                                        tabIndex={0}
                                        className={`group w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                                            entity.id === selectedEntityId
                                                ? "bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700"
                                                : "hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent"
                                        }`}
                                        onClick={() =>
                                            handleEntityClick(entity.id)
                                        }
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                            ) {
                                                e.preventDefault();
                                                handleEntityClick(entity.id);
                                            }
                                        }}
                                    >
                                        <EntityIcon
                                            entity={entity}
                                            size="2xl"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                    {entity.name}
                                                </span>
                                                {entity.id ===
                                                    selectedEntityId && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-800 text-cyan-700 dark:text-cyan-200">
                                                        {t("Current")}
                                                    </span>
                                                )}
                                            </div>
                                            {entity.description && (
                                                <p
                                                    className="text-sm text-gray-500 dark:text-gray-400 truncate"
                                                    title={entity.description}
                                                >
                                                    {entity.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                                {chatInfo?.hasChat ? (
                                                    <>
                                                        <MessageCircle className="w-3 h-3" />
                                                        <span>
                                                            {t("Last chat")}:{" "}
                                                            {formatRelativeTime(
                                                                chatInfo.lastChatTime,
                                                            )}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Clock className="w-3 h-3" />
                                                        <span>
                                                            {t("No chats yet")}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Blur before closing to avoid aria-hidden warning on focused element
                                                    document.activeElement?.blur();
                                                    // Close contacts modal first to avoid focus trap conflicts
                                                    onClose();
                                                    // Then open options dialog
                                                    setOptionsEntity(entity);
                                                }}
                                                className="p-1.5 rounded-md text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                                title={t("Entity Settings")}
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) =>
                                                    handleDeleteClick(e, entity)
                                                }
                                                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                                title={t("Remove contact")}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredEntities.length === 0 && (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    {searchQuery
                                        ? t("No contacts match your search")
                                        : t("No AI contacts yet")}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Meet New AI Button */}
                    <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleMeetNewAI}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-all hover:scale-[1.02]"
                            style={{
                                background:
                                    "linear-gradient(135deg, rgba(34, 211, 238, 0.8) 0%, rgba(167, 139, 250, 0.8) 100%)",
                                boxShadow:
                                    "0 4px 15px -3px rgba(34, 211, 238, 0.3)",
                            }}
                        >
                            <Sparkles className="w-4 h-4" />
                            {t("Meet a New AI")}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={!!entityToDelete}
                onOpenChange={() => setEntityToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("Remove Contact?")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(
                                "Are you sure you want to remove {{name}} from your contacts? You can always meet them again later.",
                                { name: entityToDelete?.name },
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {t("Remove")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Entity Options Dialog */}
            <EntityOptionsDialog
                isOpen={!!optionsEntity}
                onClose={() => setOptionsEntity(null)}
                entity={optionsEntity}
                onOpenMemoryEditor={(entityId, entityName) => {
                    setMemoryEditorEntityId(entityId);
                    setMemoryEditorEntityName(entityName);
                }}
                onOpenToolsEditor={(entityId, entityName, entityTools) => {
                    setToolsEditorEntityId(entityId);
                    setToolsEditorEntityName(entityName);
                    setToolsEditorEntityTools(entityTools);
                }}
                onOpenVoiceEditor={(entityId, entityName, voice) => {
                    setVoiceEditorEntityId(entityId);
                    setVoiceEditorEntityName(entityName);
                    setVoiceEditorCurrentVoice(voice);
                }}
                onEntityUpdate={(updatedEntity) => {
                    // Update local options entity state immediately
                    if (updatedEntity) {
                        setOptionsEntity(updatedEntity);
                    }
                }}
                refetchEntities={refetchEntities}
            />

            {/* Memory Editor */}
            <ContinuityMemoryEditor
                show={!!memoryEditorEntityId}
                onClose={() => {
                    // Re-open the entity options dialog
                    const entity = entities.find(
                        (e) => e.id === memoryEditorEntityId,
                    );
                    if (entity) {
                        setOptionsEntity(entity);
                    }
                    setMemoryEditorEntityId(null);
                    setMemoryEditorEntityName(null);
                }}
                entityId={memoryEditorEntityId}
                entityName={memoryEditorEntityName}
            />

            {/* Tools Editor */}
            <ToolsEditor
                show={!!toolsEditorEntityId}
                onClose={() => {
                    // Reopen entity options dialog with fresh entity if available
                    const freshEntity = pendingOptionsEntityRef.current;
                    if (freshEntity) {
                        setOptionsEntity(freshEntity);
                        pendingOptionsEntityRef.current = null;
                    }
                    setToolsEditorEntityId(null);
                    setToolsEditorEntityName(null);
                    setToolsEditorEntityTools([]);
                }}
                entityId={toolsEditorEntityId}
                entityName={toolsEditorEntityName}
                entityTools={toolsEditorEntityTools}
                onSave={async (tools) => {
                    const response = await fetch(
                        `/api/entities/${toolsEditorEntityId}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tools }),
                        },
                    );
                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(result.error || "Failed to save tools");
                    }
                    const currentEntity = entities.find(
                        (e) => e.id === toolsEditorEntityId,
                    );
                    pendingOptionsEntityRef.current = result.entity ||
                        (currentEntity ? { ...currentEntity, tools } : null);
                    if (refetchEntities) refetchEntities();
                }}
            />

            {/* Voice Editor */}
            <VoiceEditor
                show={!!voiceEditorEntityId}
                onClose={() => {
                    // Reopen entity options dialog with fresh entity if available
                    const freshEntity = pendingOptionsEntityRef.current;
                    if (freshEntity) {
                        setOptionsEntity(freshEntity);
                        pendingOptionsEntityRef.current = null;
                    }
                    setVoiceEditorEntityId(null);
                    setVoiceEditorEntityName(null);
                    setVoiceEditorCurrentVoice(null);
                }}
                entityId={voiceEditorEntityId}
                entityName={voiceEditorEntityName}
                currentVoice={voiceEditorCurrentVoice}
                onSave={async (voiceConfig) => {
                    const response = await fetch(
                        `/api/entities/${voiceEditorEntityId}`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(voiceConfig),
                        },
                    );
                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(
                            result.error || "Failed to save voice settings",
                        );
                    }
                    const currentEntity = entities.find(
                        (e) => e.id === voiceEditorEntityId,
                    );
                    pendingOptionsEntityRef.current = result.entity ||
                        (currentEntity
                            ? { ...currentEntity, voice: voiceConfig }
                            : null);
                    if (refetchEntities) refetchEntities();
                }}
            />
        </>
    );
}
