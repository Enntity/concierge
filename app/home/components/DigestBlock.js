"use client";

import { MessageSquare, RefreshCw, Bot, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactTimeAgo from "react-time-ago";
import { convertMessageToMarkdown } from "../../../src/components/chat/ChatMessage";
import { LanguageContext } from "../../../src/contexts/LanguageProvider";
import Loader from "../../components/loader";
import { useAddChat } from "../../queries/chats";
import { useRegenerateDigestBlock } from "../../queries/digest";
import { useTask } from "../../queries/notifications";
import classNames from "../../utils/class-names";
import { BlockEditForm } from "./DigestBlockList";

export default function DigestBlock({
    block,
    entities,
    editing,
    onChange,
    onDelete,
    contentClassName,
}) {
    const regenerateDigestBlock = useRegenerateDigestBlock();
    const addChat = useAddChat();
    const router = useRouter();
    const { t } = useTranslation();
    const { language } = useContext(LanguageContext);

    // Add task query if block has a taskId
    const { data: task } = useTask(block?.taskId);

    // Get entity info for display
    const entity = useMemo(() => {
        if (!block?.entityId || !entities) return null;
        return entities.find((e) => e.id === block.entityId);
    }, [block?.entityId, entities]);

    if (!block) {
        return null;
    }

    const isRebuilding =
        regenerateDigestBlock.isPending ||
        task?.status === "pending" ||
        task?.status === "in_progress";

    const handleOpenInChat = async () => {
        try {
            const blockContent = JSON.parse(block.content);
            const messages = [
                {
                    payload: block.prompt,
                    sender: "user",
                    sentTime: new Date().toISOString(),
                    direction: "outgoing",
                    position: "single",
                },
                {
                    payload: blockContent.payload,
                    tool: blockContent.tool,
                    sender: "enntity",
                    sentTime: new Date().toISOString(),
                    direction: "incoming",
                    position: "single",
                },
            ];
            const { _id } = await addChat.mutateAsync({
                messages,
                title: block.title,
                selectedEntityId: block.entityId,
                selectedEntityName: block.entityName || entity?.name,
            });
            router.push(`/chat/${_id}`);
        } catch (error) {
            console.error("Error creating chat:", error);
        }
    };

    // Edit mode view
    if (editing) {
        return (
            <div
                className="
                    group relative
                    bg-white dark:bg-gray-800/90 
                    p-4 sm:p-6 rounded-2xl 
                    border-2 border-cyan-400/50 dark:border-cyan-500/40
                    shadow-lg shadow-cyan-500/10
                    transition-all duration-200
                "
            >
                {/* Delete button */}
                <button
                    onClick={onDelete}
                    className="
                        absolute top-3 right-3 p-2 rounded-lg
                        text-gray-400 dark:text-gray-500 
                        hover:text-red-500 dark:hover:text-red-400 
                        hover:bg-red-50 dark:hover:bg-red-900/20 
                        transition-colors
                    "
                    title={t("Remove block")}
                >
                    <Trash2 className="h-4 w-4" />
                </button>

                <BlockEditForm
                    block={block}
                    entities={entities}
                    onChange={onChange}
                />
            </div>
        );
    }

    // Normal view mode
    return (
        <div
            className="
                group relative
                bg-white/80 dark:bg-gray-800/80 
                backdrop-blur-sm
                p-4 sm:p-6 rounded-2xl 
                border border-gray-200/80 dark:border-gray-700/50 
                shadow-sm hover:shadow-xl
                hover:border-cyan-300/50 dark:hover:border-cyan-500/30
                transition-all duration-200
            "
        >
            {/* Subtle gradient accent at top */}
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

            {/* Header - title with action icons */}
            <div className="flex items-center gap-2 mb-3">
                <h3 className="flex-1 font-semibold text-gray-900 dark:text-gray-100 text-lg truncate">
                    {block.title || t("Untitled")}
                </h3>

                {/* Action icons */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Refresh button */}
                    <button
                        className={classNames(
                            "p-2 rounded-lg transition-colors",
                            "text-gray-400 dark:text-gray-500",
                            !isRebuilding &&
                                "hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20",
                            isRebuilding && "cursor-default",
                        )}
                        onClick={() => {
                            if (!isRebuilding) {
                                regenerateDigestBlock.mutate({
                                    blockId: block._id,
                                });
                            }
                        }}
                        disabled={isRebuilding}
                        title={isRebuilding ? t("Generating...") : t("Refresh")}
                    >
                        <RefreshCw
                            className={classNames(
                                isRebuilding && "animate-spin text-cyan-500",
                            )}
                            size={18}
                        />
                    </button>

                    {/* Chat button */}
                    {block.content && (
                        <button
                            className="
                                p-2 rounded-lg 
                                text-gray-400 dark:text-gray-500 
                                hover:text-cyan-600 dark:hover:text-cyan-400 
                                hover:bg-cyan-50 dark:hover:bg-cyan-900/20 
                                transition-colors
                            "
                            onClick={handleOpenInChat}
                            title={t("Continue in chat")}
                        >
                            <MessageSquare size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Meta row - entity + timestamp */}
            <div className="flex items-center gap-3 mb-4 text-xs">
                {/* Entity badge */}
                {entity && (
                    <div className="flex items-center gap-1.5">
                        {entity.avatar?.image?.url ? (
                            <img
                                src={entity.avatar.image.url}
                                alt={entity.name}
                                className="h-4 w-4 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                            />
                        ) : (
                            <span className="h-4 w-4 rounded-full bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center text-[8px] text-white font-medium">
                                {entity.avatarText || entity.name?.[0] || "?"}
                            </span>
                        )}
                        <span className="text-gray-500 dark:text-gray-400">
                            {entity.name}
                        </span>
                    </div>
                )}

                {/* Entity was set but no longer available (lost contact) */}
                {!entity && block.entityId && (
                    <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>
                            {block.entityName
                                ? t("{{name}} unavailable", {
                                      name: block.entityName,
                                  })
                                : t("Entity unavailable")}
                        </span>
                    </div>
                )}

                {/* No entity specified - using default */}
                {!entity && !block.entityId && (
                    <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{t("Default entity")}</span>
                    </div>
                )}

                {/* Separator dot */}
                {block.updatedAt && (
                    <>
                        <span className="text-gray-300 dark:text-gray-600">
                            •
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">
                            <ReactTimeAgo
                                date={block.updatedAt}
                                locale={language}
                            />
                        </span>
                    </>
                )}
            </div>

            {/* Content */}
            <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className={contentClassName}>
                    <BlockContent block={block} isRebuilding={isRebuilding} />
                </div>
            </div>
        </div>
    );
}

function BlockContent({ block, isRebuilding }) {
    const { t } = useTranslation();
    const { data: task } = useTask(block?.taskId);

    const isGenerating =
        task?.status === "pending" || task?.status === "in_progress";

    // Show loader when generating and no content yet
    if (isGenerating && !block.content) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <div className="relative mb-4">
                    <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-lg animate-pulse" />
                    <Loader />
                </div>
                <p className="text-sm">{t("Generating content...")}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t("This may take a minute or two")}
                </p>
            </div>
        );
    }

    if (task?.status === "failed") {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-red-500 dark:text-red-400">
                <p className="text-sm font-medium mb-1">
                    {t("Generation failed")}
                </p>
                <p className="text-xs text-red-400 dark:text-red-500 text-center">
                    {task.statusText || task.error || t("Please try again")}
                </p>
            </div>
        );
    }

    if (!block.content) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                <div className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-700/50 mb-4">
                    <Bot className="h-8 w-8" />
                </div>
                <p className="text-sm">{t("No content yet")}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t("Click the refresh icon to generate")}
                </p>
            </div>
        );
    }

    // Show loader overlay when regenerating existing content
    if (isRebuilding) {
        return (
            <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-[1px] rounded-lg z-10">
                    <Loader />
                </div>
                <div className="opacity-40 prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-cyan-600 dark:prose-a:text-cyan-400">
                    {convertMessageToMarkdown(JSON.parse(block.content))}
                </div>
            </div>
        );
    }

    return (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-cyan-600 dark:prose-a:text-cyan-400">
            {convertMessageToMarkdown(JSON.parse(block.content))}
        </div>
    );
}
