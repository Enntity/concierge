import {
    HelpCircle,
    AppWindow,
    Grid3X3,
    EditIcon,
    Plus,
    Loader2,
} from "lucide-react";
import * as Icons from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useContext, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    useAddChat,
    useDeleteChat,
    useGetActiveChats,
} from "../../app/queries/chats";
import { useCurrentUser } from "../../app/queries/users";
import { useWorkspace } from "../../app/queries/workspaces";
import { usePrefetchOnHover } from "../hooks/usePrefetch";
import { useEntities } from "../hooks/useEntities";

import classNames from "../../app/utils/class-names";
import config from "../../config";
import SendFeedbackModal from "../components/help/SendFeedbackModal";
import { LanguageContext } from "../contexts/LanguageProvider";
import { ThemeContext } from "../contexts/ThemeProvider";
import ChatNavigationItem from "./ChatNavigationItem";
import { cn } from "@/lib/utils";

// Helper function to get icon component
const getIconComponent = (iconName) => {
    if (!iconName) return AppWindow; // Default fallback

    // Check if it's a Lucide icon
    if (Icons[iconName]) {
        return Icons[iconName];
    }

    // Fallback to default icon
    return AppWindow;
};

// Subtle sparkles around the logo
function LogoSparkles({ theme }) {
    const sparkles = useMemo(() => {
        return Array.from({ length: 10 }, (_, i) => {
            const driftRadius = 6 + Math.random() * 8;
            return {
                id: i,
                // Position sparkles around the logo in a circle
                angle: (i * 360) / 10,
                distance: 32 + Math.random() * 12,
                driftDuration: 8 + Math.random() * 6,
                delay: Math.random() * 3,
                size: Math.random() * 2.4 + 1.8,
                opacity: Math.random() * 0.5 + 0.35,
                // Pre-calculate drift positions
                driftX1: (Math.random() - 0.5) * driftRadius * 2,
                driftY1: (Math.random() - 0.5) * driftRadius * 2,
                driftX2: (Math.random() - 0.5) * driftRadius * 2,
                driftY2: (Math.random() - 0.5) * driftRadius * 2,
                driftX3: (Math.random() - 0.5) * driftRadius * 2,
                driftY3: (Math.random() - 0.5) * driftRadius * 2,
            };
        });
    }, []);

    // Only show sparkles in dark mode
    if (theme !== "dark") return null;

    return (
        <div className="absolute inset-0 pointer-events-none overflow-visible">
            <style jsx>{`
                @keyframes sparkle-drift {
                    0%,
                    100% {
                        transform: translate(-50%, -50%) translate(0, 0);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    25% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x1), var(--drift-y1));
                        opacity: 0.8;
                    }
                    40% {
                        opacity: 0;
                    }
                    50% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x2), var(--drift-y2));
                        opacity: 0;
                    }
                    60% {
                        opacity: 1;
                    }
                    75% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x3), var(--drift-y3));
                        opacity: 0.6;
                    }
                    90% {
                        opacity: 0;
                    }
                }
            `}</style>
            {sparkles.map((sparkle) => {
                const radian = (sparkle.angle * Math.PI) / 180;
                const x = Math.cos(radian) * sparkle.distance;
                const y = Math.sin(radian) * sparkle.distance;

                return (
                    <div
                        key={sparkle.id}
                        className="absolute rounded-full"
                        style={{
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            width: `${sparkle.size}px`,
                            height: `${sparkle.size}px`,
                            background: `radial-gradient(circle, rgba(34, 211, 238, ${sparkle.opacity}) 0%, rgba(167, 139, 250, ${sparkle.opacity * 0.6}) 50%, transparent 100%)`,
                            boxShadow: `0 0 ${sparkle.size * 2.5}px rgba(34, 211, 238, ${sparkle.opacity * 0.75}), 0 0 ${sparkle.size * 5}px rgba(167, 139, 250, ${sparkle.opacity * 0.4})`,
                            "--drift-x1": `${sparkle.driftX1}px`,
                            "--drift-y1": `${sparkle.driftY1}px`,
                            "--drift-x2": `${sparkle.driftX2}px`,
                            "--drift-y2": `${sparkle.driftY2}px`,
                            "--drift-x3": `${sparkle.driftX3}px`,
                            "--drift-y3": `${sparkle.driftY3}px`,
                            animation: `sparkle-drift ${sparkle.driftDuration}s ease-in-out infinite`,
                            animationDelay: `${sparkle.delay}s`,
                        }}
                    />
                );
            })}
        </div>
    );
}

// App slug to navigation item mapping
const appNavigationMap = {
    home: {
        name: "Home",
        href: "/home",
    },
    chat: {
        name: "Chat",
        href: "/chat",
        children: [],
    },
    translate: {
        name: "Translate",
        href: "/translate",
    },
    media: {
        name: "Media",
        href: "/media",
    },
};

// Legacy navigation for backward compatibility
export const navigation = Object.values(appNavigationMap);

const AppletEditButton = ({ workspaceId, router }) => {
    const { t } = useTranslation();
    const { data: currentUser } = useCurrentUser();
    const { data: workspace } = useWorkspace(workspaceId);

    // Check if user is the owner of the workspace
    const isOwner =
        currentUser?._id?.toString() === workspace?.owner?.toString();

    if (!isOwner) {
        return null;
    }

    const handleEditClick = (e) => {
        e.stopPropagation();
        if (workspaceId) {
            router.push(`/workspaces/${workspaceId}`);
        }
    };

    return (
        <EditIcon
            className="h-4 w-4 ml-auto text-gray-400 hover:text-sky-500 dark:hover:text-sky-400 cursor-pointer transition-colors invisible group-hover:visible"
            onClick={handleEditClick}
            title={t("Edit applet")}
        />
    );
};

export default React.forwardRef(function Sidebar({ isMobile }, ref) {
    const pathname = usePathname();
    const router = useRouter();
    const { getLogo, getSidebarLogo } = config.global;
    const { language } = useContext(LanguageContext);
    const { theme } = useContext(ThemeContext);
    const { t } = useTranslation();

    const { data: chatsData = [], isLoading: chatsLoading } =
        useGetActiveChats();
    const chats = chatsData || [];
    const { data: currentUser } = useCurrentUser();
    const { entities } = useEntities(currentUser?.contextId);

    // Check if user is authenticated
    const isAuthenticated =
        currentUser && currentUser.userId && currentUser.userId !== "anonymous";

    // Check if we're on the login page
    const isOnLoginPage = pathname === "/auth/login";

    const deleteChat = useDeleteChat();
    const addChat = useAddChat();
    const prefetchOnHover = usePrefetchOnHover();

    const handleNewChat = async () => {
        try {
            // Get the current chat's selected entity if we're on a chat page
            const chatIdMatch = pathname.match(/\/chat\/([^/]+)/);
            const currentChatId = chatIdMatch?.[1];
            const currentChat = currentChatId
                ? chats.find((c) => String(c._id) === currentChatId)
                : null;

            // Use current chat's entity, or fall back to user's default entity
            let selectedEntityId = currentChat?.selectedEntityId;
            let selectedEntityName = currentChat?.selectedEntityName;

            if (!selectedEntityId && currentUser?.defaultEntityId) {
                selectedEntityId = currentUser.defaultEntityId;
                const defaultEntity = entities?.find(
                    (e) => e.id === selectedEntityId,
                );
                selectedEntityName =
                    defaultEntity?.name || currentUser?.aiName || "AI";
            }

            // Create new chat with entity info
            const { _id } = await addChat.mutateAsync({
                messages: [],
                ...(selectedEntityId && {
                    selectedEntityId,
                    selectedEntityName,
                }),
            });
            router.push(`/chat/${String(_id)}`);
        } catch (error) {
            console.error("Error adding chat:", error);
        }
    };

    const handleDeleteChat = async (chatId) => {
        try {
            const { activeChatId, recentChatIds } =
                await deleteChat.mutateAsync({ chatId });
            if (activeChatId) {
                router.push(`/chat/${activeChatId}`);
            } else if (recentChatIds?.[0]) {
                router.push(`/chat/${recentChatIds?.[0]}`);
            }
        } catch (error) {
            console.error("Error deleting chat:", error);
        }
    };

    // Create navigation based on user's apps
    const getUserNavigation = () => {
        // Always start with Home and Chat
        const coreNavigation = [
            { ...appNavigationMap.home, icon: Icons.HomeIcon },
            { ...appNavigationMap.chat, icon: Icons.MessageCircleIcon },
        ];

        if (!currentUser?.apps || currentUser.apps.length === 0) {
            // Fallback to default navigation if user has no apps
            return coreNavigation;
        }

        // Sort user apps by order
        const sortedUserApps = [...currentUser.apps].sort(
            (a, b) => a.order - b.order,
        );

        // Create navigation items based on user's apps (excluding home and chat)
        const userAppNavigation = sortedUserApps
            .map((userApp) => {
                const app = userApp.appId; // This is now populated with app details

                if (!app) {
                    return null;
                }

                // Skip home and chat as they're always included
                if (app.slug === "home" || app.slug === "chat") {
                    return null;
                }

                // Handle applet apps differently
                if (app.type === "applet" && app.workspaceId) {
                    return {
                        name: app.name || "Applet",
                        icon: Icons[app.icon] || AppWindow,
                        href: app.slug
                            ? `/apps/${app.slug}`
                            : `/published/workspaces/${app.workspaceId}/applet`,
                        appId: userApp.appId._id || userApp.appId,
                        workspaceId: app.workspaceId,
                        type: "applet",
                    };
                }

                // Find the navigation item for this app
                const navItem = appNavigationMap[app.slug];

                if (!navItem) {
                    return null;
                }

                // Use icon from database, fallback to default AppWindow icon
                const iconComponent =
                    app.icon && app.icon.trim()
                        ? getIconComponent(app.icon)
                        : AppWindow;

                return {
                    ...navItem,
                    icon: iconComponent,
                    appId: userApp.appId._id || userApp.appId,
                };
            })
            .filter(Boolean); // Remove null items

        // Combine core navigation with user apps
        return [...coreNavigation, ...userAppNavigation];
    };

    const userNavigation = getUserNavigation();

    const updatedNavigation = userNavigation.map((item) => {
        if (item.name === "Chat" && Array.isArray(chats)) {
            const items = chats.slice(0, 3);
            return {
                ...item,
                children: items.map((chat) => ({
                    name: (() => {
                        // If there's a custom title, use it
                        if (chat?.title && chat.title !== "New Chat") {
                            return chat.title;
                        }

                        // If there's a firstMessage property (from backend), use it
                        if (chat?.firstMessage?.payload) {
                            return chat.firstMessage.payload;
                        }

                        // If there's a message in the messages array, use it
                        if (chat?.messages && chat?.messages[0]?.payload) {
                            return chat.messages[0].payload;
                        }

                        // Otherwise use "New Chat"
                        return t("New Chat");
                    })(),
                    href: chat._id ? `/chat/${chat._id}` : ``,
                    key: chat._id,
                })),
            };
        }
        return item;
    });

    return (
        <>
            <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 pt-5 relative z-[41] w-56">
                <div className="relative shrink-0 mb-4 h-16 flex items-center justify-center">
                    <LogoSparkles theme={theme} />
                    <Link
                        className="relative z-10 flex items-center justify-center w-full h-full"
                        href="/"
                    >
                        <img
                            className={cn(
                                "object-contain opacity-85 scale-150 transition-all duration-300 h-14 max-w-full",
                                theme === "dark" && "sidebar-logo-glow",
                            )}
                            src={
                                theme === "dark"
                                    ? "/app/assets/enntity_logo_dark.svg"
                                    : getLogo(language)
                            }
                            alt="Your Company"
                        />
                        <div className="transition-all">
                            {getSidebarLogo(language)}
                        </div>
                    </Link>
                </div>
                <nav className="flex flex-1 flex-col">
                    {!isAuthenticated ? (
                        // Signed out state
                        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
                            <div className="mb-4">
                                <Icons.UserX className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                {isOnLoginPage
                                    ? t("Sign in to continue")
                                    : t("Not signed in")}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                {isOnLoginPage
                                    ? t(
                                          "Complete the form to access your account",
                                      )
                                    : t(
                                          "Please sign in to access your apps and chats",
                                      )}
                            </p>
                            {!isOnLoginPage && (
                                <Link
                                    href="/auth/login"
                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-sky-600 hover:bg-sky-600/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                                >
                                    {t("Sign in")}
                                </Link>
                            )}
                        </div>
                    ) : (
                        // Authenticated state - show normal navigation
                        <ul className="flex flex-1 flex-col gap-y-4">
                            <li className="grow">
                                <ul className="-mx-2 space-y-1 overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                                    {updatedNavigation.map((item) => (
                                        <li
                                            key={item.name}
                                            className="rounded-md cursor-pointer group"
                                            onMouseEnter={() => {
                                                if (item.href) {
                                                    prefetchOnHover(item.href);
                                                }
                                            }}
                                        >
                                            <div
                                                className={classNames(
                                                    "flex items-center justify-between",
                                                    item.href &&
                                                        pathname.includes(
                                                            item.href,
                                                        ) &&
                                                        pathname === item.href
                                                        ? "bg-gray-100 dark:bg-gray-700"
                                                        : "hover:bg-gray-100 dark:hover:bg-gray-700",
                                                    "rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 dark:text-gray-200",
                                                )}
                                                onClick={() => {
                                                    if (item.href) {
                                                        router.push(item.href);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center grow gap-x-3">
                                                    <item.icon
                                                        className="h-6 w-6 shrink-0 text-gray-400"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="select-none inline">
                                                        {t(item.name)}
                                                    </span>
                                                </div>
                                                {item.name === "Chat" &&
                                                    (addChat.isPending ? (
                                                        <Loader2 className="h-6 w-6 ml-auto p-1 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 animate-spin" />
                                                    ) : (
                                                        <Plus
                                                            className="h-6 w-6 ml-auto p-1 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-800 hover:text-sky-800 dark:hover:text-sky-300 cursor-pointer inline"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNewChat();
                                                            }}
                                                        />
                                                    ))}
                                                {item.type === "applet" &&
                                                    item.workspaceId && (
                                                        <AppletEditButton
                                                            workspaceId={
                                                                item.workspaceId
                                                            }
                                                            router={router}
                                                        />
                                                    )}
                                            </div>
                                            {item.name === "Chat" &&
                                            chatsLoading ? (
                                                <div className="mt-1 px-1 flex items-center justify-center py-2">
                                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                </div>
                                            ) : (
                                                item.children?.length > 0 && (
                                                    <ul className="mt-1 px-1 block">
                                                        {item.children.map(
                                                            (subItem, index) =>
                                                                item.name ===
                                                                "Chat" ? (
                                                                    <ChatNavigationItem
                                                                        key={
                                                                            subItem.key ||
                                                                            `${item.name}-${index}`
                                                                        }
                                                                        subItem={
                                                                            subItem
                                                                        }
                                                                        pathname={
                                                                            pathname
                                                                        }
                                                                        router={
                                                                            router
                                                                        }
                                                                        handleDeleteChat={
                                                                            handleDeleteChat
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <li
                                                                        key={
                                                                            subItem.key ||
                                                                            `${item.name}-${index}`
                                                                        }
                                                                        className={classNames(
                                                                            "group flex items-center justify-between rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 my-0.5",
                                                                            pathname ===
                                                                                subItem?.href
                                                                                ? "bg-gray-100 dark:bg-gray-700"
                                                                                : "",
                                                                        )}
                                                                        onClick={() => {
                                                                            if (
                                                                                subItem.href
                                                                            ) {
                                                                                router.push(
                                                                                    subItem.href,
                                                                                );
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div
                                                                            className={`relative block py-2 pe-1 ${"text-xs ps-4 pe-4"} leading-6 text-gray-700 w-full select-none flex items-center justify-between`}
                                                                            dir={
                                                                                document
                                                                                    .documentElement
                                                                                    .dir
                                                                            }
                                                                        >
                                                                            <span
                                                                                className={`${
                                                                                    document
                                                                                        .documentElement
                                                                                        .dir ===
                                                                                    "rtl"
                                                                                        ? "pe-3"
                                                                                        : "ps-3"
                                                                                } truncate whitespace-nowrap overflow-hidden max-w-[150px]`}
                                                                                title={t(
                                                                                    subItem.name ||
                                                                                        "",
                                                                                )}
                                                                            >
                                                                                {t(
                                                                                    subItem.name ||
                                                                                        "",
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    </li>
                                                                ),
                                                        )}
                                                    </ul>
                                                )
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                            <li>
                                <div className="pt-3 pb-2 bg-gray-50 dark:bg-gray-700 -mx-5 px-5 text-gray-700 dark:text-gray-200">
                                    <button
                                        className="flex gap-2 items-center text-xs w-full hover:opacity-80 transition-opacity"
                                        onClick={() => router.push("/apps")}
                                    >
                                        <Grid3X3 className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-300" />
                                        <span className="text-xs text-gray-500 dark:text-gray-300">
                                            {t("Manage Apps")}
                                        </span>
                                    </button>
                                </div>
                                {currentUser?.role === "admin" && (
                                    <div className="pt-2 pb-2 bg-gray-50 dark:bg-gray-700 -mx-5 px-5 text-gray-700 dark:text-gray-200">
                                        <button
                                            className="flex gap-2 items-center text-xs w-full hover:opacity-80 transition-opacity"
                                            onClick={() =>
                                                router.push("/admin")
                                            }
                                        >
                                            <Icons.ShieldCheck className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-300" />
                                            <span className="text-xs text-gray-500 dark:text-gray-300">
                                                {t("Admin")}
                                            </span>
                                        </button>
                                    </div>
                                )}
                                <div className="pt-2 pb-3 bg-gray-50 dark:bg-gray-700 -mx-5 px-5 text-gray-700 dark:text-gray-200">
                                    <SendFeedbackButton ref={ref} />
                                </div>
                            </li>
                        </ul>
                    )}
                </nav>
            </div>
        </>
    );
});

const SendFeedbackButton = React.forwardRef(
    function SendFeedbackButton(_props, ref) {
        const [show, setShow] = useState(false);
        const { t } = useTranslation();

        const handleClick = () => setShow(true);

        return (
            <>
                <SendFeedbackModal
                    ref={ref}
                    show={show}
                    onHide={() => setShow(false)}
                />
                <button
                    className="flex gap-2 items-center text-xs w-full hover:opacity-80 transition-opacity"
                    onClick={handleClick}
                >
                    <HelpCircle className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-300" />
                    <span className="text-xs text-gray-500 dark:text-gray-300">
                        {t("Send feedback")}
                    </span>
                </button>
            </>
        );
    },
);
