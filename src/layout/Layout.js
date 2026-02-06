"use client";
import { Dialog, Transition } from "@headlessui/react";
import { Menu, Layers, X, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
    Fragment,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
} from "react";
import { useSelector } from "react-redux";
import { Flip, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthContext } from "../App";
import ChatBox from "../components/chat/ChatBox";
import EntityIcon from "../components/chat/EntityIcon";
import EntityContactsModal from "../components/chat/EntityContactsModal";
import NotificationButton from "../components/notifications/NotificationButton";
import EntityOverlay from "../components/EntityOverlay";
import { VoiceModeOverlay } from "../components/voice/VoiceModeOverlay";
import Tos from "../components/Tos";
import UserOptions from "../components/UserOptions";
import { LanguageContext } from "../contexts/LanguageProvider";
import { useOnboarding } from "../contexts/OnboardingContext";
import { ProgressProvider } from "../contexts/ProgressContext";
import { useEntityOverlay } from "../contexts/EntityOverlayContext";
import { ThemeContext } from "../contexts/ThemeProvider";
import { useGetActiveChat, useUpdateActiveChat } from "../../app/queries/chats";
import { useEntities } from "../hooks/useEntities";
import { useChatEntity } from "../contexts/ChatEntityContext";
import Footer from "./Footer";
import ProfileDropdown from "./ProfileDropdown";
import Sidebar from "./Sidebar";

const ROUTES_WITHOUT_SIDEBAR = [];

export default function Layout({ children }) {
    const [showOptions, setShowOptions] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showTos, setShowTos] = useState(false);
    const [showContactsModal, setShowContactsModal] = useState(false);
    const statePosition = useSelector((state) => state.chat?.chatBox?.position);
    const { user } = useContext(AuthContext);
    const pathname = usePathname();
    const router = useRouter();
    const { theme } = useContext(ThemeContext);
    const { direction } = useContext(LanguageContext);
    const { shouldHideAppChrome } = useOnboarding();
    const contentRef = useRef(null);
    const {
        replayLast,
        hasLastOverlay,
        visible: overlayVisible,
    } = useEntityOverlay();
    const { data: activeChat } = useGetActiveChat();
    const updateActiveChat = useUpdateActiveChat();
    const { entities, refetch: refetchEntities } = useEntities(user?.contextId);
    const {
        entityId: chatEntityId,
        entityName: chatEntityName,
        entity: chatEntity,
        isEntityUnavailable: chatEntityUnavailable,
    } = useChatEntity();

    // Use entity from chat context if on chat page, otherwise fall back to active chat or default
    const currentEntityId = useMemo(() => {
        if (chatEntityId) return chatEntityId;
        if (activeChat?.selectedEntityId) return activeChat.selectedEntityId;
        return user?.defaultEntityId || "";
    }, [chatEntityId, activeChat?.selectedEntityId, user?.defaultEntityId]);

    const currentEntity = useMemo(() => {
        // Prefer entity from chat context (has full entity object for read-only chats)
        if (chatEntity) return chatEntity;
        // Otherwise find in user's entities
        return entities?.find((entity) => entity.id === currentEntityId);
    }, [chatEntity, entities, currentEntityId]);

    // Entity is unavailable if chat says so, or if we have an ID but can't find the entity
    const isEntityUnavailable =
        chatEntityUnavailable ||
        (currentEntityId && !chatEntity && !currentEntity);

    const entityDisplayName =
        currentEntity?.name ||
        chatEntityName ||
        activeChat?.selectedEntityName ||
        "";

    // Global entity contacts modal event listener (only when not on chat page)
    useEffect(() => {
        const handleOpenContacts = () => {
            // Chat.js has its own handler, so skip on chat pages
            if (pathname?.startsWith("/chat")) return;
            setShowContactsModal(true);
        };
        window.addEventListener("open-entity-contacts", handleOpenContacts);
        return () => {
            window.removeEventListener(
                "open-entity-contacts",
                handleOpenContacts,
            );
        };
    }, [pathname]);

    // Handle entity selection from global modal
    const handleGlobalEntitySelect = useCallback(
        (entityId) => {
            const selectedEntity = entities?.find((e) => e.id === entityId);
            const newEntityName = selectedEntity?.name || "";

            // If we're on a chat page with an active chat, update that chat
            if (pathname?.startsWith("/chat") && activeChat?.id) {
                updateActiveChat.mutate({
                    chatId: activeChat.id,
                    selectedEntityId: entityId,
                    selectedEntityName: newEntityName,
                });
            } else {
                // Navigate to chat with this entity
                router.push(`/chat?entityId=${entityId}`);
            }
            setShowContactsModal(false);
        },
        [entities, pathname, activeChat?.id, updateActiveChat, router],
    );

    const handleShowOptions = () => setShowOptions(true);
    const handleCloseOptions = () => setShowOptions(false);

    const showChatbox = statePosition !== "closed" && pathname !== "/chat";

    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    // Add viewport height fix for mobile browsers
    useEffect(() => {
        // Function to update the viewport height CSS variable
        const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty("--vh", `${vh}px`);
        };

        // Set the viewport height initially
        setViewportHeight();

        // Update the viewport height on resize
        window.addEventListener("resize", setViewportHeight);

        // Clean up the event listener
        return () => window.removeEventListener("resize", setViewportHeight);
    }, []);

    if (ROUTES_WITHOUT_SIDEBAR.includes(pathname)) {
        return <>{children}</>;
    }

    // Hide all app chrome during first-run onboarding
    // This prevents the "half-baked app" flash before Vesper appears
    if (shouldHideAppChrome) {
        return null;
    }

    return (
        <>
            <div>
                <Transition.Root show={sidebarOpen} as={Fragment}>
                    <Dialog
                        as="div"
                        className="relative z-50 lg:hidden"
                        onClose={setSidebarOpen}
                    >
                        <Transition.Child
                            as={Fragment}
                            enter="transition-opacity ease-linear duration-300"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="transition-opacity ease-linear duration-300"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="fixed inset-0 bg-gray-900/80" />
                        </Transition.Child>

                        <div className="fixed inset-0 flex">
                            <Transition.Child
                                as={Fragment}
                                enter="transition ease-in-out duration-300 transform"
                                enterFrom={
                                    direction === "ltr"
                                        ? "-translate-x-full"
                                        : "translate-x-full"
                                }
                                enterTo={
                                    direction === "ltr"
                                        ? "translate-x-0"
                                        : "-translate-x-0"
                                }
                                leave="transition ease-in-out duration-300 transform"
                                leaveFrom={
                                    direction === "ltr"
                                        ? "translate-x-0"
                                        : "-translate-x-0"
                                }
                                leaveTo={
                                    direction === "ltr"
                                        ? "-translate-x-full"
                                        : "translate-x-full"
                                }
                            >
                                <Dialog.Panel className="relative me-16 flex w-full max-w-xs flex-1">
                                    <Transition.Child
                                        as={Fragment}
                                        enter="ease-in-out duration-300"
                                        enterFrom="opacity-0"
                                        enterTo="opacity-100"
                                        leave="ease-in-out duration-300"
                                        leaveFrom="opacity-100"
                                        leaveTo="opacity-0"
                                    >
                                        <div className="absolute start-full top-0 flex w-16 justify-center pt-5">
                                            <button
                                                type="button"
                                                className="-m-2.5 p-2.5"
                                                onClick={() =>
                                                    setSidebarOpen(false)
                                                }
                                            >
                                                <span className="sr-only">
                                                    Close sidebar
                                                </span>
                                                <X
                                                    className="h-6 w-6 text-white dark:text-gray-100"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </div>
                                    </Transition.Child>
                                    {/* Sidebar component, swap this element with another sidebar if you like */}
                                    <Sidebar ref={contentRef} isMobile={true} />
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </Dialog>
                </Transition.Root>

                {/* Static sidebar for desktop */}
                <div className="hidden lg:fixed lg:inset-y-0 lg:z-[41] lg:flex lg:flex-col lg:w-56">
                    <Sidebar ref={contentRef} />
                </div>

                <div className="lg:ps-56">
                    <div className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 shadow-sm sm:gap-x-6 sm:px-3 lg:px-4">
                        <button
                            type="button"
                            className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-300 lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <span className="sr-only">Open sidebar</span>
                            <Menu className="h-6 w-6" aria-hidden="true" />
                        </button>

                        {/* Separator */}
                        <div
                            className="h-6 w-px bg-gray-900/10 dark:bg-gray-100/10 lg:hidden"
                            aria-hidden="true"
                        />

                        <div className="relative flex flex-1 items-center justify-end">
                            <div className="absolute left-0 flex items-center gap-2">
                                {/* Avatar button - opens contacts list */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (typeof window !== "undefined") {
                                            window.dispatchEvent(
                                                new CustomEvent(
                                                    "open-entity-contacts",
                                                ),
                                            );
                                        }
                                    }}
                                    className="flex items-center gap-2 cursor-pointer"
                                    aria-label="Open entity contacts"
                                    title={
                                        entityDisplayName ||
                                        currentEntity?.name ||
                                        "Select entity"
                                    }
                                >
                                    <div
                                        className={`rounded-full bg-white/70 dark:bg-gray-900/70 p-0.5 transition-all ${
                                            overlayVisible
                                                ? "ring-2 ring-cyan-300/90 shadow-[0_0_24px_rgba(34,211,238,0.6),0_0_40px_rgba(59,130,246,0.35)]"
                                                : "ring-1 ring-gray-200/60 dark:ring-gray-700/60 hover:ring-gray-300 dark:hover:ring-gray-600"
                                        }`}
                                    >
                                        {currentEntity ? (
                                            <EntityIcon
                                                entity={currentEntity}
                                                size="lg"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                <Users className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                            </div>
                                        )}
                                    </div>
                                    {/* Entity name */}
                                    {entityDisplayName && (
                                        <span className="text-sm text-gray-500 dark:text-gray-400 font-light tracking-wide">
                                            {pathname?.startsWith("/chat") && (
                                                <span className="hidden sm:inline">
                                                    Chatting with{" "}
                                                </span>
                                            )}
                                            <span
                                                className={`font-medium ${isEntityUnavailable ? "text-gray-400 dark:text-gray-500 italic" : "text-gray-700 dark:text-gray-200"}`}
                                            >
                                                {entityDisplayName}
                                                {isEntityUnavailable && (
                                                    <span className="text-amber-500 ml-1 text-xs">
                                                        (offline)
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    )}
                                </button>
                                {/* Overlay button - replays last overlay */}
                                {currentEntity &&
                                    hasLastOverlay(currentEntity.id) && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                replayLast(currentEntity.id)
                                            }
                                            className={`flex items-center justify-center rounded-full p-2 transition-all ${
                                                overlayVisible
                                                    ? "ring-2 ring-cyan-400/80 bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                                                    : "border border-cyan-400/50 bg-white/70 dark:bg-gray-900/70 text-cyan-500 dark:text-cyan-400 hover:bg-cyan-50/80 dark:hover:bg-cyan-900/30"
                                            }`}
                                            aria-label="Show entity overlay"
                                        >
                                            <Layers className="h-4 w-4" />
                                        </button>
                                    )}
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center h-9">
                                    <NotificationButton />
                                </div>
                                <ProfileDropdown
                                    user={user}
                                    handleShowOptions={handleShowOptions}
                                    setShowTos={setShowTos}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="relative flex-col">
                        <ProgressProvider>
                            <main
                                className={`p-2 bg-slate-50 dark:bg-gray-900 flex ${showChatbox ? "gap-2" : ""}`}
                                ref={contentRef}
                            >
                                <div
                                    className={`${showChatbox ? "grow" : "w-full"} bg-white dark:bg-gray-800 dark:border-gray-700 rounded-md border p-3 lg:p-4 lg:pb-3 overflow-auto`}
                                    style={{
                                        height: "calc((var(--vh, 1vh) * 100) - 105px)",
                                    }}
                                >
                                    {showOptions && (
                                        <UserOptions
                                            show={showOptions}
                                            handleClose={handleCloseOptions}
                                        />
                                    )}
                                    <Tos
                                        showTos={showTos}
                                        setShowTos={setShowTos}
                                    />
                                    {children}
                                </div>
                                {showChatbox && (
                                    <div
                                        className="hidden sm:block h-[calc(100vh-105px)]"
                                        style={{
                                            height: "calc((var(--vh, 1vh) * 100) - 105px)",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <ChatBox />
                                    </div>
                                )}
                                <ToastContainer
                                    position={
                                        direction === "rtl"
                                            ? "top-left"
                                            : "top-right"
                                    }
                                    autoClose={10000}
                                    hideProgressBar={false}
                                    newestOnTop={false}
                                    closeOnClick
                                    rtl={direction === "rtl"}
                                    pauseOnFocusLoss
                                    draggable
                                    pauseOnHover
                                    theme={theme === "dark" ? "dark" : "light"}
                                    transition={Flip}
                                />
                                {/* Entity Overlay - floats over content on both desktop and mobile */}
                                <EntityOverlay />

                                {/* Voice Mode Overlay - only for non-chat pages (Chat.js handles voice mode inline) */}
                                {!pathname?.startsWith("/chat") && (
                                    <VoiceModeOverlay />
                                )}

                                {/* Global Entity Contacts Modal */}
                                <EntityContactsModal
                                    isOpen={showContactsModal}
                                    onClose={() => setShowContactsModal(false)}
                                    entities={entities}
                                    selectedEntityId={currentEntityId}
                                    onEntitySelect={handleGlobalEntitySelect}
                                    refetchEntities={refetchEntities}
                                />
                            </main>
                        </ProgressProvider>
                        <Footer />
                    </div>
                </div>
            </div>
        </>
    );
}
