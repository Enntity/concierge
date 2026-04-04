import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import classNames from "../../../app/utils/class-names";
import { AuthContext } from "../../App";
import { InlineAssistantPayload } from "./BotMessage";
import {
    ASSISTANT_PAYLOAD_ITEM_TYPES,
    parseAssistantPayloadItem,
} from "../../utils/assistantInlinePayload";

const formatLocalizedNumber = (language, value) => {
    try {
        return new Intl.NumberFormat(language).format(value);
    } catch {
        return String(value);
    }
};

const hasRenderableInlineItems = (items = []) =>
    Array.isArray(items) &&
    items.some((item) => {
        const parsed = parseAssistantPayloadItem(item);
        if (!parsed) {
            return typeof item === "string" && item.trim().length > 0;
        }
        if (
            parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT ||
            parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING
        ) {
            return (
                typeof parsed.text === "string" && parsed.text.trim().length > 0
            );
        }
        return true;
    });

const hasInlineThinkingItem = (items = []) =>
    Array.isArray(items) &&
    items.some(
        (item) =>
            parseAssistantPayloadItem(item)?.type ===
            ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING,
    );

const StreamingMessage = React.memo(function StreamingMessage({
    content,
    inlinePayloadItems = [],
    thinkingDuration,
    isThinking,
}) {
    const { t, i18n } = useTranslation();
    const { user } = useContext(AuthContext);
    const hasInlineItems = hasRenderableInlineItems(inlinePayloadItems);
    const hasStreamingText =
        typeof content === "string" && content.trim().length > 0;
    const hasVisibleContent = hasInlineItems || hasStreamingText;
    const showThinkingFooter = !hasInlineThinkingItem(inlinePayloadItems);
    const localizedDuration = formatLocalizedNumber(
        i18n.language,
        thinkingDuration,
    );

    return (
        <div className="flex bg-white dark:bg-gray-800 ps-1 pt-1 relative group rounded-b-lg rounded-tl-lg rtl:rounded-tl-none rtl:rounded-tr-lg border border-cyan-400/50 dark:border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.15)] dark:shadow-[0_0_15px_rgba(34,211,238,0.25)]">
            <div
                className={classNames(
                    "px-2 pb-3 pt-2 [.docked_&]:px-0 [.docked_&]:py-3 w-full",
                )}
            >
                <div className="flex flex-col">
                    {hasVisibleContent ? (
                        <div className="chat-message-bot relative break-words text-gray-800 dark:text-gray-100">
                            <InlineAssistantPayload
                                items={
                                    hasInlineItems
                                        ? inlinePayloadItems
                                        : [
                                              JSON.stringify({
                                                  type: "text",
                                                  text: content,
                                              }),
                                          ]
                                }
                                message={{
                                    id: "streaming-inline-payload",
                                    sender: "enntity",
                                }}
                                isStreaming={Boolean(isThinking)}
                                defaultThinkingDuration={thinkingDuration}
                                currentUser={user}
                            />
                        </div>
                    ) : null}
                    {showThinkingFooter ? (
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-transparent bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 dark:from-gray-100 dark:via-gray-400 dark:to-gray-100 bg-clip-text animate-shimmer bg-[length:200%_100%]">
                            {t("Thinking with duration", {
                                duration: localizedDuration,
                            })}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
});

StreamingMessage.displayName = "StreamingMessage";
export default StreamingMessage;
