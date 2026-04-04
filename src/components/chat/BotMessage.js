import { CheckCircle, XCircle, Loader2, Check } from "lucide-react";
import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCancelTask, useTask } from "../../../app/queries/notifications";
import classNames from "../../../app/utils/class-names";
import { TASK_INFO } from "../../utils/task-info";
import {
    getExtension,
    getFilename,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    isAudioUrl,
    isVideoUrl,
} from "../../utils/mediaUtils";
import { getYoutubeEmbedUrl } from "../../utils/urlUtils";
import {
    ASSISTANT_PAYLOAD_ITEM_TYPES,
    buildLegacyInlineAssistantPayloadItems,
    parseAssistantPayloadItem,
} from "../../utils/assistantInlinePayload";
import CopyButton from "../CopyButton";
import SignedImage from "../common/media/SignedImage";
import MediaCard from "./MediaCard";
import { convertMessageToMarkdown } from "./ChatMessage";
import { AuthContext } from "../../App";
import {
    ConversationModeInfoButton,
    normalizeConversationModeData,
} from "./ConversationModeInfo";

const MemoizedMarkdownMessage = React.memo(
    ({ message, onLoad, onMermaidFix }) => {
        return convertMessageToMarkdown(message, true, onLoad, onMermaidFix);
    },
    (prevProps, nextProps) => {
        // If messages are completely identical, no need to re-render
        if (prevProps.message === nextProps.message) {
            return true;
        }

        // If payloads are strings and identical, no need to re-render
        if (
            typeof prevProps.message.payload === "string" &&
            typeof nextProps.message.payload === "string" &&
            prevProps.message.payload === nextProps.message.payload
        ) {
            return true;
        }

        // For array payloads, we need to compare each item
        if (
            Array.isArray(prevProps.message.payload) &&
            Array.isArray(nextProps.message.payload)
        ) {
            if (
                prevProps.message.payload.length !==
                nextProps.message.payload.length
            ) {
                return false;
            }

            // Compare each item in the array
            return prevProps.message.payload.every((item, index) => {
                const nextItem = nextProps.message.payload[index];
                try {
                    const prevObj =
                        typeof item === "string" ? JSON.parse(item) : item;
                    const nextObj =
                        typeof nextItem === "string"
                            ? JSON.parse(nextItem)
                            : nextItem;

                    // For image URLs, only compare the base URL without query parameters
                    if (
                        prevObj.type === "image_url" &&
                        nextObj.type === "image_url"
                    ) {
                        const prevUrl = new URL(
                            prevObj.url || prevObj.image_url?.url,
                        ).pathname;
                        const nextUrl = new URL(
                            nextObj.url || nextObj.image_url?.url,
                        ).pathname;
                        return prevUrl === nextUrl;
                    }

                    return JSON.stringify(prevObj) === JSON.stringify(nextObj);
                } catch (e) {
                    // If JSON parsing fails, compare as strings
                    return item === nextItem;
                }
            });
        }

        // Default to re-rendering if we can't determine equality
        return false;
    },
);

const formatLocalizedNumber = (language, value) => {
    try {
        return new Intl.NumberFormat(language).format(value);
    } catch {
        return String(value);
    }
};

const deriveInitials = (value = "") => {
    const parts = String(value).trim().split(/\s+/).filter(Boolean);

    if (!parts.length) return "";

    return parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
};

const getInlineUserIdentity = (currentUser) => {
    const normalizedUser = currentUser?.user || currentUser || {};
    return {
        picture:
            normalizedUser.picture ||
            normalizedUser.profilePicture ||
            normalizedUser.avatar ||
            null,
        blobPath: normalizedUser.profilePictureBlobPath || null,
        name: normalizedUser.name || normalizedUser.fullName || "User",
        initials:
            normalizedUser.initials ||
            deriveInitials(
                normalizedUser.name ||
                    normalizedUser.fullName ||
                    normalizedUser.email ||
                    normalizedUser.username ||
                    "",
            ),
    };
};

const ToolEventStatusIcon = ({ status }) => {
    if (status === "thinking") {
        return (
            <Loader2 className="h-3 w-3 text-gray-500 dark:text-gray-400 animate-spin" />
        );
    }
    if (status === "completed") {
        return <Check className="h-3 w-3 text-green-500 dark:text-green-400" />;
    }
    if (status === "failed") {
        return <XCircle className="h-3 w-3 text-red-500 dark:text-red-400" />;
    }
    return null;
};

const ToolEventItem = React.memo(function ToolEventItem({
    item,
    count = 1,
    currentUser = null,
}) {
    const { t, i18n } = useTranslation();
    const localizedCount = formatLocalizedNumber(i18n.language, count);
    const isInlineUserMessage = item.presentation === "inline_user";
    const inlineUser = getInlineUserIdentity(currentUser);

    if (isInlineUserMessage) {
        return (
            <div className="flex">
                <div className="relative w-full rounded-md border border-sky-200/25 bg-sky-100/35 px-3 py-2 dark:border-white/10 dark:bg-slate-500/20">
                    <div className="absolute top-1/2 start-3 flex h-5 w-5 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-sky-200/85 dark:bg-sky-900/35">
                        {inlineUser.picture ? (
                            <SignedImage
                                src={inlineUser.picture}
                                blobPath={inlineUser.blobPath}
                                alt={inlineUser.name}
                                className="h-full w-full object-cover"
                                fallback={
                                    inlineUser.initials ? (
                                        <span className="text-[9px] font-medium leading-none text-sky-600 dark:text-sky-400">
                                            {inlineUser.initials}
                                        </span>
                                    ) : (
                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
                                    )
                                }
                            />
                        ) : inlineUser.initials ? (
                            <span className="text-[9px] font-medium leading-none text-sky-600 dark:text-sky-400">
                                {inlineUser.initials}
                            </span>
                        ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
                        )}
                    </div>
                    <div className="w-full ps-8 pe-1">
                        <div className="chat-message-user whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700 dark:text-slate-100">
                            {item.userMessage}
                        </div>
                        {count > 1 && (
                            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                                {t("Repeated count", {
                                    value: localizedCount,
                                })}
                            </div>
                        )}
                        {item.error && (
                            <div className="mt-1 text-red-600 dark:text-red-300">
                                {item.error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-2 rtl:flex-row-reverse text-[13px] leading-5 text-gray-500 dark:text-gray-400">
            <div className="mt-1 flex-shrink-0 rtl:order-2">
                <ToolEventStatusIcon status={item.status} />
            </div>
            <div className="min-w-0 flex-1 rtl:order-1 rtl:text-right">
                <span className="mr-1 rtl:mr-0 rtl:ml-1 opacity-80">
                    {item.icon}
                </span>
                <span>{item.userMessage}</span>
                {count > 1 && (
                    <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500 rtl:ml-0 rtl:mr-2">
                        {t("Repeated count", { value: localizedCount })}
                    </span>
                )}
                {item.error && (
                    <span className="ml-1 text-red-500 dark:text-red-400 rtl:ml-0 rtl:mr-1">
                        ({item.error})
                    </span>
                )}
            </div>
        </div>
    );
});

const collapseToolEvents = (items) => {
    const collapsed = [];

    items.forEach((item) => {
        const key = JSON.stringify({
            icon: item.icon || "",
            userMessage: item.userMessage || "",
            status: item.status || "",
            error: item.error || "",
            presentation: item.presentation || "",
        });
        const previous = collapsed[collapsed.length - 1];

        if (previous?.key === key) {
            previous.count += 1;
            return;
        }

        collapsed.push({
            key,
            item,
            count: 1,
        });
    });

    return collapsed;
};

const ToolEventGroup = React.memo(function ToolEventGroup({
    items,
    currentUser = null,
}) {
    const collapsedItems = collapseToolEvents(items);

    return (
        <div className="my-1">
            <div className="flex flex-col gap-1">
                {collapsedItems.map(({ item, count }, index) => (
                    <ToolEventItem
                        key={item.callId || `${item.userMessage}-${index}`}
                        item={item}
                        count={count}
                        currentUser={currentUser}
                    />
                ))}
            </div>
        </div>
    );
});

const ThinkingItem = React.memo(function ThinkingItem({
    item,
    isStreaming,
    defaultDuration,
    onLoad,
    onMermaidFix,
}) {
    const { t, i18n } = useTranslation();
    const duration =
        Number.isFinite(item?.duration) && item.duration >= 0
            ? item.duration
            : defaultDuration;
    const localizedDuration = formatLocalizedNumber(i18n.language, duration);
    const thinkingLabel = isStreaming
        ? t("Thinking with duration", {
              duration: localizedDuration,
          })
        : t("Thought for duration", {
              duration: localizedDuration,
          });
    const hasThinkingText =
        typeof item?.text === "string" && item.text.trim().length > 0;
    const markdownFinalRender = !isStreaming;

    return (
        <div>
            <div
                className={classNames(
                    hasThinkingText ? "mb-1" : "",
                    "text-[11px] font-semibold uppercase tracking-[0.08em]",
                    isStreaming
                        ? "text-transparent bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 dark:from-gray-100 dark:via-gray-400 dark:to-gray-100 bg-clip-text animate-shimmer bg-[length:200%_100%]"
                        : "text-gray-500 dark:text-gray-400",
                )}
            >
                {thinkingLabel}
            </div>
            {hasThinkingText ? (
                <div className="text-gray-600 dark:text-gray-300">
                    {convertMessageToMarkdown(
                        { payload: item.text, sender: "enntity" },
                        markdownFinalRender,
                        onLoad,
                        onMermaidFix,
                    )}
                </div>
            ) : null}
        </div>
    );
});

const renderMediaPayloadItem = ({ item, key, onLoad, t }) => {
    if (item.hideFromClient === true && item.isDeletedFile === true) {
        const deletedFilename = item.deletedFilename || "file";
        const deletedExt = getExtension(deletedFilename);
        let deletedType = "file";
        if (
            isVideoUrl(deletedFilename) ||
            VIDEO_EXTENSIONS.includes(deletedExt)
        ) {
            deletedType = "video";
        } else if (IMAGE_EXTENSIONS.includes(deletedExt)) {
            deletedType = "image";
        }

        return (
            <MediaCard
                key={key}
                type={deletedType}
                src={null}
                filename={deletedFilename}
                isDeleted={true}
                t={t}
            />
        );
    }

    if (item.hideFromClient === true) {
        return null;
    }

    const src = item?.url || item?.image_url?.url || item?.file;
    if (!src) return null;

    const displayFilename = item?.displayFilename || item?.originalFilename;

    let filename;
    let ext;
    try {
        filename = displayFilename || decodeURIComponent(getFilename(src));
        ext = getExtension(src);
    } catch (error) {
        console.error("Error extracting assistant media metadata:", error);
        return null;
    }

    if (isAudioUrl(src)) {
        return (
            <audio
                key={key}
                onLoadedData={onLoad}
                src={src}
                className="max-h-[20%] max-w-[100%] rounded-md border bg-white p-1 my-2 dark:border-neutral-700 dark:bg-neutral-800 shadow-lg dark:shadow-black/30"
                controls
            />
        );
    }

    if (isVideoUrl(src)) {
        const youtubeEmbedUrl = getYoutubeEmbedUrl(src);
        if (youtubeEmbedUrl) {
            return (
                <MediaCard
                    key={key}
                    type="youtube"
                    src={src}
                    filename={filename}
                    youtubeEmbedUrl={youtubeEmbedUrl}
                    onLoad={onLoad}
                    t={t}
                />
            );
        }

        return (
            <MediaCard
                key={key}
                type="video"
                src={src}
                filename={filename}
                onLoad={onLoad}
                t={t}
            />
        );
    }

    const mediaType =
        item.type === "image_url" || IMAGE_EXTENSIONS.includes(ext)
            ? "image"
            : "file";

    return (
        <MediaCard
            key={key}
            type={mediaType}
            src={src}
            filename={filename}
            onLoad={mediaType === "image" ? onLoad : undefined}
            t={t}
        />
    );
};

const isArtifactPayloadItem = (parsed) =>
    !!parsed &&
    (parsed.type === "image_url" ||
        parsed.type === "file" ||
        parsed.isDeletedFile === true);

const isBlankPayloadItem = (item, parsed) =>
    (!parsed && (typeof item !== "string" || item.trim().length === 0)) ||
    (parsed?.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT &&
        (typeof parsed.text !== "string" || parsed.text.trim().length === 0));

const isSummaryOnlyThinkingItem = (parsed) =>
    parsed?.type === ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING &&
    (typeof parsed.text !== "string" || parsed.text.trim().length === 0);

const buildChronologicalBlocks = (items) => {
    const blocks = [];
    let currentToolItems = [];
    const thinkingItems = [];

    const flushToolItems = () => {
        if (!currentToolItems.length) return;
        blocks.push({
            type: "tool_group",
            items: currentToolItems,
        });
        currentToolItems = [];
    };

    items.forEach((entry) => {
        if (entry.parsed?.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TOOL_EVENT) {
            currentToolItems.push(entry.parsed);
            return;
        }

        if (entry.parsed?.type === ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING) {
            flushToolItems();
            thinkingItems.push({
                type: "item",
                ...entry,
            });
            return;
        }

        flushToolItems();
        blocks.push({
            type: "item",
            ...entry,
        });
    });

    flushToolItems();
    return [...blocks, ...thinkingItems];
};

export const InlineAssistantPayload = React.memo(
    function InlineAssistantPayload({
        items = [],
        message,
        onLoad,
        onMermaidFix,
        isStreaming = false,
        defaultThinkingDuration = 0,
        currentUser = null,
    }) {
        const { t } = useTranslation();
        const normalizedItems = useMemo(
            () => (Array.isArray(items) ? items.filter(Boolean) : []),
            [items],
        );
        const stableMessageId = String(
            message?._clientId ||
                message?.sentTime ||
                message?.id ||
                message?._id ||
                message?.taskId ||
                "assistant",
        );

        const { bodyBlocks, footerBlocks } = useMemo(() => {
            if (!normalizedItems.length) {
                return { bodyBlocks: [], footerBlocks: [] };
            }

            const chronologicalItems = [];
            const occurrenceCounts = new Map();

            normalizedItems.forEach((item, index) => {
                const parsed = parseAssistantPayloadItem(item);
                const baseKey = JSON.stringify(parsed || item || index);
                const occurrence = occurrenceCounts.get(baseKey) || 0;
                occurrenceCounts.set(baseKey, occurrence + 1);

                if (isBlankPayloadItem(item, parsed)) {
                    return;
                }

                chronologicalItems.push({
                    item,
                    parsed,
                    key: `${stableMessageId}-${baseKey}-${occurrence}`,
                });
            });

            const blocks = buildChronologicalBlocks(chronologicalItems);
            const nextBodyBlocks = [];
            const nextFooterBlocks = [];

            blocks.forEach((block) => {
                if (
                    block.type === "item" &&
                    isSummaryOnlyThinkingItem(block.parsed)
                ) {
                    if (isStreaming) {
                        nextFooterBlocks.push(block);
                    }
                    return;
                }
                nextBodyBlocks.push(block);
            });

            return {
                bodyBlocks: nextBodyBlocks,
                footerBlocks: nextFooterBlocks,
            };
        }, [isStreaming, normalizedItems, stableMessageId]);

        if (!normalizedItems.length) {
            return null;
        }

        const markdownFinalRender = !isStreaming;

        const renderStandardItem = ({ item, parsed, key }) => {
            if (!parsed) {
                if (typeof item !== "string" || item.trim().length === 0) {
                    return null;
                }
                return (
                    <div key={key}>
                        {convertMessageToMarkdown(
                            {
                                ...message,
                                payload: typeof item === "string" ? item : "",
                            },
                            markdownFinalRender,
                            onLoad,
                            onMermaidFix,
                        )}
                    </div>
                );
            }

            if (parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING) {
                return (
                    <ThinkingItem
                        key={key}
                        item={parsed}
                        isStreaming={isStreaming}
                        defaultDuration={defaultThinkingDuration}
                        onLoad={onLoad}
                        onMermaidFix={onMermaidFix}
                    />
                );
            }

            if (parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT) {
                if (
                    typeof parsed.text !== "string" ||
                    parsed.text.trim().length === 0
                ) {
                    return null;
                }
                return (
                    <div key={key}>
                        {convertMessageToMarkdown(
                            {
                                ...message,
                                payload: parsed.text || "",
                            },
                            markdownFinalRender,
                            onLoad,
                            onMermaidFix,
                        )}
                    </div>
                );
            }

            if (isArtifactPayloadItem(parsed)) {
                return renderMediaPayloadItem({
                    item: parsed,
                    key,
                    onLoad,
                    t,
                });
            }

            return null;
        };

        return (
            <div className="flex flex-col">
                {bodyBlocks.length ? (
                    <div className="flex flex-col gap-2">
                        {bodyBlocks.map((block, index) => {
                            if (block.type === "tool_group") {
                                return (
                                    <ToolEventGroup
                                        key={`${stableMessageId}-tool-group-${index}`}
                                        items={block.items}
                                        currentUser={currentUser}
                                    />
                                );
                            }

                            return renderStandardItem(block);
                        })}
                    </div>
                ) : null}
                {footerBlocks.map((block) => (
                    <div
                        key={block.key}
                        className={classNames(bodyBlocks.length ? "mt-1" : "")}
                    >
                        {renderStandardItem(block)}
                    </div>
                ))}
            </div>
        );
    },
);

const TaskPlaceholder = ({ message, onTaskStatusUpdate }) => {
    const { data: serverTask } = useTask(message.taskId);
    const task = message.task || serverTask;

    const [displayName, setDisplayName] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [showFullOutput, setShowFullOutput] = useState(false);
    const cancelRequest = useCancelTask();
    const { t } = useTranslation();
    const statusTextScrollRef = useRef(null);
    const prevStatusTextRef = useRef(null);

    useEffect(() => {
        if (!task) {
            return;
        }

        // Use TASK_INFO directly instead of async getTaskDisplayName
        const displayName = TASK_INFO[task.type]?.displayName || task.type;
        setDisplayName(displayName);

        // Auto-expand for in-progress tasks
        if (task.status === "in_progress" || task.status === "pending") {
            if (task.progress > 0 && task.statusText) {
                setExpanded(true);
            }
        } else {
            setExpanded(false);
        }
    }, [task]);

    // Auto-scroll status text to bottom when content changes
    useEffect(() => {
        if (statusTextScrollRef.current && expanded && task?.statusText) {
            // Use requestAnimationFrame to ensure DOM has updated
            requestAnimationFrame(() => {
                if (statusTextScrollRef.current) {
                    statusTextScrollRef.current.scrollTop =
                        statusTextScrollRef.current.scrollHeight;
                }
            });
        }
    }, [task?.statusText, expanded]);

    // Trigger messages list scroll when task status text changes
    useEffect(() => {
        if (!task?.statusText) return;
        if (prevStatusTextRef.current === task.statusText) return;
        prevStatusTextRef.current = task.statusText;
        // Only trigger scroll if statusText actually changed and we have content
        if (task.statusText.trim() && onTaskStatusUpdate) {
            // Use a small delay to ensure DOM has updated
            requestAnimationFrame(() => {
                onTaskStatusUpdate();
            });
        }
    }, [task, onTaskStatusUpdate]);

    if (!task) {
        return null;
    }

    const { status, statusText, progress, data } = task;
    const isInProgress = status === "in_progress" || status === "pending";

    const toggleExpanded = () => {
        setExpanded(!expanded);
    };

    // Add confirmation dialog handler
    const handleCancelClick = (e) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to cancel this task?")) {
            cancelRequest.mutate(message.taskId);
        }
    };

    // Helper function to convert status to sentence case
    const sentenceCase = (str) => {
        if (!str) return "";
        return str
            .replace(/_/g, " ")
            .replace(
                /\w\S*/g,
                (txt) =>
                    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
            );
    };

    // Get status badge color based on status
    const getStatusBadgeColor = (status) => {
        switch (status) {
            case "completed":
                return "bg-green-100 text-green-800 border-green-200";
            case "failed":
            case "abandoned":
            case "cancelled":
                return "bg-red-100 text-red-800 border-red-200";
            case "in_progress":
                return "bg-sky-100 text-sky-800 border-sky-200";
            case "pending":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            default:
                return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600";
        }
    };

    return (
        <div className="">
            <div
                className="relative flex items-center gap-2 cursor-pointer font-semibold"
                onClick={toggleExpanded}
            >
                {isInProgress ? (
                    <>
                        <span className="inline-block text-transparent bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 dark:from-gray-100 dark:via-gray-400 dark:to-gray-100 bg-clip-text animate-shimmer bg-[length:200%_100%] font-semibold me-1">
                            {t(displayName)}
                        </span>
                        <svg
                            className={`h-4 w-4 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                        <button
                            onClick={handleCancelClick}
                            className="p-1 hover:bg-gray-200 rounded-full"
                            title="Cancel task"
                        >
                            <XCircle className="w-4 h-4 text-gray-500" />
                        </button>
                    </>
                ) : (
                    <span className="font-medium flex items-center gap-1">
                        {t(displayName)}
                        <svg
                            className={`h-4 w-4 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                        {status === "completed" && (
                            <span className="text-green-500">
                                <CheckCircle className="w-4 h-4" />
                            </span>
                        )}
                        {(status === "failed" ||
                            status === "cancelled" ||
                            status === "abandoned") && (
                            <span className="text-red-500">
                                <XCircle className="w-4 h-4" />
                            </span>
                        )}
                    </span>
                )}
            </div>
            {expanded && (
                <div className="text-gray-600 dark:text-gray-300 mt-1 ps-3 border-s-2 border-gray-400 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 py-2 px-3 rounded-r-md">
                    {!isInProgress && status !== "completed" && (
                        <div className="flex items-center gap-2 my-2">
                            <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(status)} border`}
                            >
                                {sentenceCase(status)}
                            </span>
                            {status === "cancelled" && (
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                    This task was cancelled by the user
                                </span>
                            )}
                        </div>
                    )}
                    {statusText && (
                        <div>
                            <div className="text-gray-600 dark:text-gray-300 text-sm font-semibold">
                                Output
                            </div>
                            <pre
                                ref={statusTextScrollRef}
                                className="my-1 p-2 text-xs border bg-gray-50 dark:bg-gray-700 rounded-md relative whitespace-pre-wrap font-sans max-h-[140px] overflow-y-auto scroll-smooth"
                            >
                                {showFullOutput || statusText.length <= 150 ? (
                                    statusText?.trim()
                                ) : (
                                    <>
                                        {statusText.trim().substring(0, 150)}...
                                        <div className="mt-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowFullOutput(true);
                                                }}
                                                className="text-sky-600 hover:text-sky-800 font-medium text-xs"
                                            >
                                                Show more
                                            </button>
                                        </div>
                                    </>
                                )}
                                {showFullOutput &&
                                    statusText.trim().length > 150 && (
                                        <div className="mt-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowFullOutput(false);
                                                }}
                                                className="text-sky-600 hover:text-sky-800 font-medium text-xs"
                                            >
                                                Show less
                                            </button>
                                        </div>
                                    )}
                            </pre>
                        </div>
                    )}
                    {progress !== undefined && progress > 0 && progress < 1 && (
                        <div className="my-2">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                <div
                                    className="bg-sky-600 h-2.5 rounded-full"
                                    style={{ width: `${progress * 100}%` }}
                                ></div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {Math.round(progress * 100)}% completed
                            </span>
                        </div>
                    )}
                </div>
            )}

            {!isInProgress && (
                <div className="chat-message-bot">
                    {convertMessageToMarkdown({
                        payload: data?.message || JSON.stringify(data),
                    })}
                </div>
            )}
        </div>
    );
};

const BotMessage = ({
    message,
    toolData,
    bot,
    basis,
    buttonWidthClass,
    rowHeight,
    getLogo,
    language,
    botName,
    messageRef = () => {},
    selectedEntityId,
    entities = [],
    entityIconSize,
    onLoad,
    onTaskStatusUpdate,
    onMermaidFix,
}) => {
    const { data: serverTask } = useTask(message.taskId);
    const task = message.task || serverTask;
    const { user } = useContext(AuthContext);
    const legacyInlineItems = buildLegacyInlineAssistantPayloadItems({
        ephemeralContent: message.ephemeralContent,
        toolCalls: message.toolCalls,
        thinkingDuration: message.thinkingDuration,
    });
    const inlineItems =
        Array.isArray(message.payload) && message.sender === "enntity"
            ? message.payload
            : [
                  ...legacyInlineItems,
                  ...(typeof message.payload === "string" &&
                  message.payload.trim()
                      ? [
                            JSON.stringify({
                                type: ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT,
                                text: message.payload,
                            }),
                        ]
                      : []),
              ];
    const hasInlineItems = Array.isArray(inlineItems) && inlineItems.length > 0;
    const modeData = normalizeConversationModeData(
        toolData?.modeMessage || toolData?.entityRuntime || toolData,
    );

    return (
        <div
            key={message.id}
            className="flex bg-white dark:bg-gray-800 ps-1 pt-1 relative group rounded-b-lg rounded-tl-lg rtl:rounded-tl-none rtl:rounded-tr-lg border border-gray-300 dark:border-gray-600"
        >
            <div className="flex items-center gap-2 absolute top-3 end-3 z-10">
                <ConversationModeInfoButton
                    modeData={modeData}
                    className="opacity-0 group-hover:opacity-80 hover:opacity-100 transition-opacity pointer-events-auto"
                />
                <CopyButton
                    item={
                        typeof message.payload === "string"
                            ? message.payload
                            : message.text
                    }
                    className="copy-button opacity-0 group-hover:opacity-80 hover:opacity-100 transition-opacity pointer-events-auto"
                />
            </div>

            <div
                className={classNames(
                    "px-2 pb-3 pt-2 [.docked_&]:px-0 [.docked_&]:py-3 w-full",
                )}
            >
                <div className="flex flex-col">
                    <div
                        className="chat-message-bot relative break-words"
                        ref={(el) => messageRef(el, message.id)}
                    >
                        <React.Fragment key={`md-${message.id}`}>
                            {message.taskId && task ? (
                                <TaskPlaceholder
                                    message={message}
                                    onTaskStatusUpdate={onTaskStatusUpdate}
                                />
                            ) : hasInlineItems ? (
                                <InlineAssistantPayload
                                    items={inlineItems}
                                    message={message}
                                    onLoad={onLoad}
                                    onMermaidFix={onMermaidFix}
                                    isStreaming={Boolean(message.isStreaming)}
                                    defaultThinkingDuration={
                                        message.thinkingDuration ?? 0
                                    }
                                    currentUser={user}
                                />
                            ) : (
                                <MemoizedMarkdownMessage
                                    message={message}
                                    onLoad={onLoad}
                                    onMermaidFix={onMermaidFix}
                                />
                            )}
                        </React.Fragment>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(BotMessage);
