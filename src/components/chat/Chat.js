"use client";

import { useTranslation } from "react-i18next";
import ChatContent from "./ChatContent";
import dynamic from "next/dynamic";
import {
    useUpdateActiveChat,
    useGetActiveChat,
    useGetChatById,
    useSetActiveChatId,
    useAddChat,
} from "../../../app/queries/chats";
import { useContext, useState, useEffect, useRef, useMemo } from "react";
import { AuthContext } from "../../App";
import { useParams, useRouter } from "next/navigation";
import EntityContactsModal from "./EntityContactsModal";
import {
    Trash2,
    Download,
    Users,
    Copy,
    Info,
    MoreVertical,
    Plus,
    Loader2,
} from "lucide-react";
import { useEntities } from "../../hooks/useEntities";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { useChatEntity } from "../../contexts/ChatEntityContext";
import { useVoice } from "../../contexts/VoiceContext";
import { VoiceModeContent } from "../voice/VoiceModeContent";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const ChatTopMenuDynamic = dynamic(() => import("./ChatTopMenu"), {
    loading: () => <div style={{ width: "80px", height: "20px" }}></div>,
});

/**
 * Determines which chat to use based on URL and viewing state.
 * Matches the logic in ChatContent.js for consistency:
 * 1. If viewing a read-only chat, use viewingChat
 * 2. Otherwise, if URL chat is available, use urlChat
 * 3. Otherwise, fall back to active chat
 */
function getChatToUse(urlChatId, urlChat, viewingChat, activeChat) {
    // If viewing a read-only chat, use it directly
    if (viewingChat && viewingChat.readOnly) {
        return viewingChat;
    }

    // Otherwise, use URL chat if available
    if (urlChatId && urlChat) {
        return urlChat;
    }

    // Fall back to active chat
    return activeChat;
}

function Chat({ viewingChat = null }) {
    const { t, i18n } = useTranslation();
    const params = useParams();
    const router = useRouter();
    const urlChatId = params?.id;
    const updateActiveChat = useUpdateActiveChat();
    const setActiveChatId = useSetActiveChatId();
    const addChat = useAddChat();
    const { data: activeChat } = useGetActiveChat();
    const { data: urlChat } = useGetChatById(urlChatId);
    const { pendingOnboardingNav, confirmOnboardingNavigation } =
        useOnboarding();

    const isRTL = i18n.dir() === "rtl";

    // Memoize chat determination to avoid recalculation on every render
    const chat = useMemo(
        () => getChatToUse(urlChatId, urlChat, viewingChat, activeChat),
        [urlChatId, urlChat, viewingChat, activeChat],
    );
    const activeChatId = useMemo(() => chat?._id, [chat?._id]);
    const { user } = useContext(AuthContext);
    const { readOnly } = viewingChat || {};
    const publicChatOwner = viewingChat?.owner;
    const { isActive: voiceModeActive } = useVoice();

    // Track the last URL chat ID we've updated to prevent duplicate calls
    const lastUpdatedUrlChatId = useRef(null);

    // Update active chat ID asynchronously in the background after reading from URL
    // This is non-blocking and only used for ChatBox fallback purposes
    useEffect(() => {
        // Skip if no URL chat ID or already updated this ID
        if (!urlChatId || urlChatId === lastUpdatedUrlChatId.current) {
            return;
        }

        // Skip if viewing a read-only chat or chat doesn't exist
        if (viewingChat || !urlChat || urlChat.readOnly) {
            return;
        }

        // Skip if already matches active chat (no update needed)
        if (urlChatId === activeChat?._id) {
            lastUpdatedUrlChatId.current = urlChatId;
            return;
        }

        // Update active chat ID asynchronously in the background (non-blocking)
        // This is only for ChatBox fallback, not for navigation
        lastUpdatedUrlChatId.current = urlChatId;
        setActiveChatId.mutate(urlChatId, {
            onError: (error) => {
                console.error("Error updating active chat ID:", error);
                // Reset on error so we can retry
                lastUpdatedUrlChatId.current = null;
            },
        });
    }, [urlChatId, activeChat?._id, viewingChat, urlChat, setActiveChatId]);

    // Signal to onboarding that this chat is ready (closes the onboarding modal)
    useEffect(() => {
        if (pendingOnboardingNav && urlChatId && urlChat) {
            // Chat data is loaded and ready to display
            confirmOnboardingNavigation(urlChatId);
        }
    }, [pendingOnboardingNav, urlChatId, urlChat, confirmOnboardingNavigation]);

    const [selectedEntityId, setSelectedEntityId] = useState(
        chat?.selectedEntityId || "",
    );
    const [selectedEntityName, setSelectedEntityName] = useState(
        chat?.selectedEntityName || "",
    );
    const [showPublicConfirm, setShowPublicConfirm] = useState(false);
    const [showUnshareConfirm, setShowUnshareConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSharedByDialog, setShowSharedByDialog] = useState(false);
    const [showContactsModal, setShowContactsModal] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const { entities, refetch: refetchEntities } = useEntities(user?.contextId);

    // Sync local state with fetched chat data
    // Every chat has an entityId stored - just use it
    useEffect(() => {
        const entityIdFromChat = chat?.selectedEntityId || "";
        const entityNameFromChat = chat?.selectedEntityName || "";
        if (entityIdFromChat !== selectedEntityId) {
            setSelectedEntityId(entityIdFromChat);
        }
        if (entityNameFromChat !== selectedEntityName) {
            setSelectedEntityName(entityNameFromChat);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chat?.selectedEntityId, chat?.selectedEntityName, activeChatId]);

    // Check if the selected entity is available (in the user's entity list)
    const isEntityUnavailable =
        selectedEntityId && !entities.some((e) => e.id === selectedEntityId);
    const currentEntity = entities.find((e) => e.id === selectedEntityId);
    const { setChatEntity } = useChatEntity();

    // Update the header with entity information
    useEffect(() => {
        if (chat) {
            setChatEntity({
                entityId: selectedEntityId,
                entityName: selectedEntityName,
                entity: currentEntity,
                isEntityUnavailable: isEntityUnavailable,
            });
        } else {
            // Clear entity info when not on a chat page
            setChatEntity({
                entityId: null,
                entityName: null,
                entity: null,
                isEntityUnavailable: false,
            });
        }

        // Cleanup: clear entity info when component unmounts
        return () => {
            setChatEntity({
                entityId: null,
                entityName: null,
                entity: null,
                isEntityUnavailable: false,
            });
        };
    }, [
        chat,
        selectedEntityId,
        selectedEntityName,
        currentEntity,
        isEntityUnavailable,
        setChatEntity,
    ]);

    const handleShare = () => {
        setShowPublicConfirm(true);
    };

    const handleCopyUrl = async () => {
        const shareUrl = `${window.location.origin}/chat/${chat._id}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
        } catch (error) {
            console.error("Error copying URL:", error);
        }
    };

    const handleUnshare = async () => {
        try {
            await updateActiveChat.mutateAsync({ isPublic: false });
        } catch (error) {
            console.error("Error unsharing chat:", error);
        }
    };

    const handleEntityChange = (entityId) => {
        const selectedEntity = entities.find((e) => e.id === entityId);
        const newEntityName = selectedEntity?.name || "";
        setSelectedEntityId(entityId);
        setSelectedEntityName(newEntityName);
        if (activeChatId) {
            updateActiveChat.mutate({
                chatId: activeChatId,
                selectedEntityId: entityId,
                selectedEntityName: newEntityName,
            });
        }
    };

    const handleMakePublic = async () => {
        try {
            const shareUrl = `${window.location.origin}/chat/${chat._id}`;
            await updateActiveChat.mutateAsync({ isPublic: true });
            document.body.focus();
            await navigator.clipboard.writeText(shareUrl);
        } catch (error) {
            console.error("Error making chat public:", error);
        }
    };

    const handleNewChat = async () => {
        try {
            const result = await addChat.mutateAsync({
                selectedEntityId,
                selectedEntityName,
            });
            if (result?._id) {
                router.push(`/chat/${result._id}`);
            }
        } catch (error) {
            console.error("Error creating new chat:", error);
        }
    };

    const handleExportActiveChat = () => {
        try {
            const chatToExport = viewingChat || chat;
            if (!chatToExport?._id || !chatToExport?.messages?.length) return;

            const now = new Date();
            const stamp = now.toISOString().replace(/[:T]/g, "-").split(".")[0];
            const fileName = `chat-${String(chatToExport._id)}-${stamp}.json`;
            const blob = new Blob([JSON.stringify(chatToExport, null, 2)], {
                type: "application/json",
            });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        } catch (error) {
            console.error("Error exporting chat:", error);
        }
    };

    const handleDelete = async () => {
        try {
            if (activeChatId) {
                updateActiveChat.mutate({
                    chatId: activeChatId,
                    messages: [],
                    title: "",
                });
            }
        } catch (error) {
            console.error("Error deleting chat:", error);
        }
    };

    // Determine if current user owns this chat
    const isChatOwner = !readOnly && !publicChatOwner;
    const isShared = chat?.isPublic;

    const handleCopyChat = async () => {
        try {
            const chatToCopy = viewingChat || chat;
            if (!chatToCopy?._id || !chatToCopy?.messages?.length) return;

            // Use the user's default entity
            const defaultEntity = entities.find(
                (e) => e.id === user?.defaultEntityId,
            );
            const newEntityName = defaultEntity?.name || user?.aiName || "AI";

            const { _id } = await addChat.mutateAsync({
                messages: chatToCopy.messages,
                title: chatToCopy.title
                    ? `${t("Copy of")} ${chatToCopy.title}`
                    : t("Copy of chat"),
                selectedEntityId: user?.defaultEntityId || "",
                selectedEntityName: newEntityName,
            });
            setShowSharedByDialog(false);
            router.push(`/chat/${_id}`);
        } catch (error) {
            console.error("Error copying chat:", error);
        }
    };

    useEffect(() => {
        const handleOpenContacts = () => {
            if (readOnly || publicChatOwner) return;
            setShowContactsModal(true);
        };
        window.addEventListener("open-entity-contacts", handleOpenContacts);
        return () => {
            window.removeEventListener(
                "open-entity-contacts",
                handleOpenContacts,
            );
        };
    }, [readOnly, publicChatOwner]);

    return (
        <div className="flex flex-col gap-3 h-full">
            <div className="flex justify-between items-center gap-2">
                {/* Left: Read-only badge or Research/Files */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {readOnly ? (
                        <button
                            onClick={
                                publicChatOwner
                                    ? () => setShowSharedByDialog(true)
                                    : undefined
                            }
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors border bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 text-xs ${
                                publicChatOwner
                                    ? "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                                    : "cursor-default"
                            }`}
                            title={
                                publicChatOwner
                                    ? `${t("Shared by")} ${publicChatOwner?.name || publicChatOwner?.username || ""}`
                                    : t("Read-only mode")
                            }
                        >
                            <span className="truncate">{t("Read-only")}</span>
                            {publicChatOwner && (
                                <Info className="w-3 h-3 flex-shrink-0" />
                            )}
                        </button>
                    ) : (
                        <ChatTopMenuDynamic
                            readOnly={readOnly || !!publicChatOwner}
                        />
                    )}
                </div>

                {/* Right: New chat + Menu */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* New chat button */}
                    {!readOnly && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={handleNewChat}
                                        disabled={addChat.isPending}
                                        className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-800 hover:text-sky-800 dark:hover:text-sky-300 transition-colors flex-shrink-0 disabled:opacity-70"
                                        title={t("New chat")}
                                    >
                                        {addChat.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Plus className="w-4 h-4" />
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>{t("New chat")}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* More options menu */}
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="flex items-center justify-center p-1.5 rounded-md transition-colors border bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                                title={t("More options")}
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align={isRTL ? "start" : "end"}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                            onInteractOutside={() => setMenuOpen(false)}
                            onEscapeKeyDown={() => setMenuOpen(false)}
                        >
                            <DropdownMenuItem
                                onClick={() => {
                                    handleExportActiveChat();
                                    setMenuOpen(false);
                                }}
                                disabled={!chat?.messages?.length}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                {t("Export")}
                            </DropdownMenuItem>

                            {isChatOwner && !readOnly && (
                                <>
                                    <DropdownMenuSeparator />
                                    {isShared ? (
                                        <>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    handleCopyUrl();
                                                    setMenuOpen(false);
                                                }}
                                            >
                                                <Copy className="w-4 h-4 mr-2" />
                                                {t("Copy Share URL")}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setShowUnshareConfirm(true);
                                                    setMenuOpen(false);
                                                }}
                                                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                            >
                                                <Users className="w-4 h-4 mr-2" />
                                                {t("Unshare")}
                                            </DropdownMenuItem>
                                        </>
                                    ) : (
                                        <DropdownMenuItem
                                            onClick={() => {
                                                handleShare();
                                                setMenuOpen(false);
                                            }}
                                        >
                                            <Users className="w-4 h-4 mr-2" />
                                            {t("Share")}
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}

                            {!readOnly && !publicChatOwner && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => {
                                            setShowDeleteConfirm(true);
                                            setMenuOpen(false);
                                        }}
                                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {t("Clear chat")}
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="grow overflow-auto">
                {voiceModeActive ? (
                    <VoiceModeContent />
                ) : (
                    <ChatContent
                        viewingChat={viewingChat}
                        streamingEnabled={user.streamingEnabled}
                        selectedEntityId={selectedEntityId}
                        entities={entities}
                        entityIconSize="lg"
                        isEntityUnavailable={isEntityUnavailable}
                    />
                )}
            </div>

            <AlertDialog
                open={showPublicConfirm}
                onOpenChange={setShowPublicConfirm}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("Make this chat public?")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(
                                "This will make this chat visible to anyone with the link.",
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            autoFocus
                            onClick={() => {
                                handleMakePublic();
                                setShowPublicConfirm(false);
                            }}
                        >
                            {t("Make Public")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={showUnshareConfirm}
                onOpenChange={setShowUnshareConfirm}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("Unshare this chat?")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(
                                "This will make this chat private. People with the link will no longer be able to access it.",
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            autoFocus
                            onClick={() => {
                                handleUnshare();
                                setShowUnshareConfirm(false);
                            }}
                        >
                            {t("Unshare")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Clear Chat?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(
                                "Are you sure you want to clear this chat? This action cannot be undone.",
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            autoFocus
                            onClick={() => {
                                handleDelete();
                                setShowDeleteConfirm(false);
                            }}
                        >
                            {t("Clear")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog
                open={showSharedByDialog}
                onOpenChange={setShowSharedByDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("Shared Chat")}</DialogTitle>
                        <DialogDescription>
                            {t("This chat was shared by")}{" "}
                            <span className="font-semibold">
                                {publicChatOwner?.name ||
                                    publicChatOwner?.username ||
                                    t("Unknown")}
                            </span>{" "}
                            {t(
                                "and is read only. You can read it but cannot change it.",
                            )}
                            <br />
                            <br />
                            {t(
                                "You can make a copy of this chat if you'd like to continue it.",
                            )}{" "}
                            {t(
                                "This will not give you access to the files used in the shared chat.",
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowSharedByDialog(false)}
                        >
                            {t("Close")}
                        </Button>
                        <Button
                            onClick={handleCopyChat}
                            disabled={addChat.isPending}
                            className="flex items-center gap-2"
                        >
                            <Copy className="w-4 h-4" />
                            {addChat.isPending
                                ? t("Copying...")
                                : t("Copy Chat")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <EntityContactsModal
                isOpen={showContactsModal}
                onClose={() => setShowContactsModal(false)}
                entities={entities}
                selectedEntityId={selectedEntityId}
                onEntitySelect={handleEntityChange}
                refetchEntities={refetchEntities}
            />
        </div>
    );
}

export default Chat;
