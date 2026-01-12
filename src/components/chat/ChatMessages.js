import React, {
    useContext,
    useCallback,
    useMemo,
    useRef,
    useState,
    useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import dynamic from "next/dynamic";
import { AuthContext } from "../../App.js";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import { ThemeContext } from "../../contexts/ThemeProvider";

const ChatTopMenuDynamic = dynamic(() => import("./ChatTopMenu"));

// Subtle background sparkles for chat area
function ChatBackgroundSparkles() {
    const { theme } = useContext(ThemeContext);
    const [sparkles, setSparkles] = useState([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (theme !== "dark") return;

        const newSparkles = Array.from({ length: 20 }, (_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            delay: `${Math.random() * 5}s`,
            duration: `${6 + Math.random() * 4}s`,
            size: Math.random() * 2 + 1.5,
            opacity: Math.random() * 0.3 + 0.15,
        }));
        setSparkles(newSparkles);
    }, [theme]);

    if (!mounted || theme !== "dark") return null;

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {sparkles.map((sparkle) => (
                <div
                    key={sparkle.id}
                    className="absolute rounded-full"
                    style={{
                        left: sparkle.left,
                        top: sparkle.top,
                        width: `${sparkle.size}px`,
                        height: `${sparkle.size}px`,
                        background: `radial-gradient(circle, rgba(34, 211, 238, ${sparkle.opacity}) 0%, rgba(167, 139, 250, ${sparkle.opacity * 0.7}) 50%, transparent 100%)`,
                        boxShadow: `0 0 ${sparkle.size * 4}px rgba(34, 211, 238, ${sparkle.opacity * 1.2}), 0 0 ${sparkle.size * 8}px rgba(167, 139, 250, ${sparkle.opacity * 0.6})`,
                        animation: `sparkle-float ${sparkle.duration} ease-in-out infinite`,
                        animationDelay: sparkle.delay,
                        zIndex: 0,
                    }}
                />
            ))}
            <style jsx>{`
                @keyframes sparkle-float {
                    0%,
                    100% {
                        opacity: 0.1;
                        transform: translate(0, 0) scale(0.5);
                    }
                    50% {
                        opacity: 1;
                        transform: translate(0, 0) scale(1.2);
                    }
                }
            `}</style>
        </div>
    );
}

const ChatMessages = React.memo(function ChatMessages({
    messages = [],
    onSend,
    loading,
    container,
    displayState,
    viewingReadOnlyChat,
    publicChatOwner,
    chatId,
    streamingContent,
    ephemeralContent,
    toolCalls,
    isStreaming,
    onStopStreaming,
    thinkingDuration,
    isThinking,
    selectedEntityId,
    entities,
    entityIconSize,
    contextId,
    contextKey,
    isEntityUnavailable = false,
}) {
    const { user } = useContext(AuthContext);
    const { t } = useTranslation();
    const { aiName } = user;
    const messageListRef = useRef(null);

    const handleSendCallback = useCallback(
        (text) => {
            // Reset scroll state when user sends a message
            messageListRef.current?.scrollBottomRef?.current?.resetScrollState();
            onSend(text);
        },
        [onSend],
    );

    const inputPlaceholder = useMemo(() => {
        if (isEntityUnavailable) {
            return t("Select an available AI to continue chatting");
        }
        if (container === "codebox") {
            return t("Ask me to write, explain, or fix code");
        }
        return t("Send a message");
    }, [container, t, isEntityUnavailable]);

    return (
        <div className="flex flex-col h-full">
            <div className="hidden justify-between items-center px-3 pb-2 text-xs [.docked_&]:hidden">
                <ChatTopMenuDynamic
                    displayState={displayState}
                    publicChatOwner={publicChatOwner}
                />
            </div>
            <div className="grow overflow-auto chat-message-list flex flex-col bg-transparent dark:!bg-gray-800 relative">
                <ChatBackgroundSparkles />
                <MessageList
                    ref={messageListRef}
                    messages={messages}
                    loading={loading && !isStreaming}
                    chatId={chatId}
                    bot={container === "codebox" ? "code" : "chat"}
                    streamingContent={streamingContent}
                    isStreaming={isStreaming}
                    isChatLoading={loading}
                    aiName={aiName}
                    ephemeralContent={ephemeralContent}
                    toolCalls={toolCalls}
                    thinkingDuration={thinkingDuration}
                    isThinking={isThinking}
                    selectedEntityId={selectedEntityId}
                    entities={entities}
                    entityIconSize={entityIconSize}
                    onSend={onSend}
                    contextId={contextId}
                    contextKey={contextKey}
                />
            </div>
            <div className="flex-shrink-0">
                <MessageInput
                    viewingReadOnlyChat={viewingReadOnlyChat}
                    loading={loading}
                    enableRag={true}
                    placeholder={inputPlaceholder}
                    container={container}
                    displayState={displayState}
                    onSend={handleSendCallback}
                    isStreaming={isStreaming}
                    onStopStreaming={onStopStreaming}
                    isEntityUnavailable={isEntityUnavailable}
                />
            </div>
        </div>
    );
});

export default ChatMessages;
