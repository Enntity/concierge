"use client";

import { MessageSquare, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import ReactTimeAgo from "react-time-ago";
import { Progress } from "../../../@/components/ui/progress";
import { convertMessageToMarkdown } from "../../../src/components/chat/ChatMessage";
import { LanguageContext } from "../../../src/contexts/LanguageProvider";
import Loader from "../../components/loader";
import { useAddChat } from "../../queries/chats";
import { useRegenerateDigestBlock } from "../../queries/digest";
import { useTask } from "../../queries/notifications";
import classNames from "../../utils/class-names";

export default function DigestBlock({ block, contentClassName }) {
    const regenerateDigestBlock = useRegenerateDigestBlock();
    const addChat = useAddChat();
    const router = useRouter();
    const { t } = useTranslation();
    const { language } = useContext(LanguageContext);

    // Add task query if block has a taskId
    const { data: task } = useTask(block?.taskId);

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
            });
            router.push(`/chat/${_id}`);
        } catch (error) {
            console.error("Error creating chat:", error);
        }
    };

    return (
        <div
            key={block._id}
            className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
            <div className="flex justify-between gap-3 items-center mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {block.title}
                </h3>
                <div className="flex items-center gap-2">
                    {block.content && (
                        <button
                            className="shrink-0 p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={handleOpenInChat}
                            title={t("Open in chat")}
                        >
                            <MessageSquare size={16} />
                        </button>
                    )}
                    <button
                        className={classNames(
                            "text-xs flex items-center gap-2 rounded-full px-3 py-1.5 border transition-all duration-200",
                            "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300",
                            task?.status !== "pending" &&
                                task?.status !== "in_progress" &&
                                "cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:border-sky-300 dark:hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400",
                        )}
                        onClick={() => {
                            if (
                                task?.status !== "pending" &&
                                task?.status !== "in_progress"
                            ) {
                                regenerateDigestBlock.mutate({
                                    blockId: block._id,
                                });
                            }
                        }}
                        disabled={isRebuilding}
                    >
                        {block.updatedAt &&
                            (!isRebuilding || !task?.progress) && (
                                <RefreshCw
                                    className={classNames(
                                        "shrink-0",
                                        isRebuilding ? "animate-spin" : "",
                                    )}
                                    size={14}
                                />
                            )}
                        <span className="whitespace-nowrap">
                            {isRebuilding ? (
                                task?.progress ? (
                                    <Progress
                                        value={
                                            Math.min(
                                                Math.max(task.progress, 0),
                                                1,
                                            ) * 100
                                        }
                                        className="w-20"
                                    />
                                ) : (
                                    t("Rebuilding...")
                                )
                            ) : block.updatedAt ? (
                                <span className="flex items-center gap-1">
                                    <span className="hidden lg:inline">
                                        {t("Updated")}
                                    </span>
                                    <ReactTimeAgo
                                        date={block.updatedAt}
                                        locale={language}
                                    />
                                </span>
                            ) : (
                                t("Build now")
                            )}
                        </span>
                    </button>
                </div>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
                <div className={contentClassName}>
                    <BlockContent block={block} />
                </div>
            </div>
        </div>
    );
}

function BlockContent({ block }) {
    const { t } = useTranslation();
    const { data: task } = useTask(block?.taskId);

    if (
        (task?.status === "pending" || task?.status === "in_progress") &&
        !block.content
    ) {
        return (
            <div className="text-gray-500 dark:text-gray-400 flex items-center gap-4 py-4">
                <Loader />
                <span>
                    {t("Building")}. {t("This may take a minute or two.")}
                </span>
            </div>
        );
    }

    if (task?.status === "failed") {
        return (
            <div className="text-red-600 dark:text-red-400 py-2">
                {t("Error building digest block:")}{" "}
                {task.statusText || task.error}
            </div>
        );
    }

    if (!block.content) {
        return (
            <div className="text-gray-400 dark:text-gray-500 italic py-2">
                {t("No content yet")}
            </div>
        );
    }

    return convertMessageToMarkdown(JSON.parse(block.content));
}
