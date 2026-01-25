"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    PlusIcon,
    Pencil,
    Check,
    X,
    Sparkles,
    Bot,
    GripVertical,
    LayoutGrid,
    Square,
} from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Loader from "../../components/loader";
import {
    useCurrentUserDigest,
    useUpdateCurrentUserDigest,
    useDigestEntities,
    useHomeGreeting,
} from "../../queries/digest";
import { useCurrentUser } from "../../queries/users";
import classNames from "../../utils/class-names";
import DigestBlock from "./DigestBlock";

// Greeting component - compact banner with reserved space to prevent layout shift
const HomeGreeting = React.memo(function HomeGreeting() {
    const { data, isLoading: greetingLoading } = useHomeGreeting();
    const greeting = data?.greeting;
    const entity = data?.entity;
    const textRef = React.useRef(null);
    const containerRef = React.useRef(null);
    const measuredGreetingRef = React.useRef(null);
    const [shouldScroll, setShouldScroll] = useState(false);

    // Check if text overflows container - only remeasure when greeting actually changes
    useEffect(() => {
        if (greeting && greeting !== measuredGreetingRef.current) {
            // Use requestAnimationFrame to ensure DOM is painted before measuring
            requestAnimationFrame(() => {
                if (textRef.current && containerRef.current) {
                    const textWidth = textRef.current.scrollWidth;
                    const containerWidth = containerRef.current.clientWidth;
                    setShouldScroll(textWidth > containerWidth);
                    measuredGreetingRef.current = greeting;
                }
            });
        }
    }, [greeting]);

    // Always render with fixed height to prevent layout shift
    return (
        <div className="mb-2 min-h-[2.75rem] flex items-center">
            <div className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-gray-50/50 to-gray-100/30 dark:from-gray-800/30 dark:to-gray-900/20 border border-gray-200/30 dark:border-gray-700/30 px-4 py-2">
                {/* Shimmer skeleton - visible while loading */}
                {greetingLoading && (
                    <div className="h-5 w-full rounded bg-gradient-to-r from-gray-200/50 via-gray-100/80 to-gray-200/50 dark:from-gray-700/50 dark:via-gray-600/80 dark:to-gray-700/50 bg-[length:200%_100%] animate-shimmer" />
                )}

                {/* Actual greeting content - ticker scroll if overflows */}
                {greeting && !greetingLoading && (
                    <div ref={containerRef} className="overflow-hidden flex items-center gap-2">
                        {/* Entity avatar */}
                        {entity && (
                            <div className="flex-shrink-0">
                                {entity.avatar?.image?.url ? (
                                    <img
                                        src={entity.avatar.image.url}
                                        alt={entity.name || ""}
                                        className="h-6 w-6 rounded-full object-cover ring-1 ring-gray-200/50 dark:ring-gray-700/50"
                                    />
                                ) : (
                                    <span className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center text-xs font-medium text-white ring-1 ring-gray-200/50 dark:ring-gray-700/50">
                                        {entity.avatarText || entity.name?.[0] || "?"}
                                    </span>
                                )}
                            </div>
                        )}
                        {/* Greeting text */}
                        <div className="overflow-hidden flex-1">
                            <div
                                ref={textRef}
                                className={`inline-flex whitespace-nowrap ${
                                    shouldScroll ? "animate-ticker" : ""
                                }`}
                            >
                                <span className="text-sm sm:text-base font-medium leading-snug bg-gradient-to-r from-cyan-600 via-purple-500 to-cyan-600 dark:from-cyan-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift">
                                    {greeting}
                                </span>
                                {shouldScroll && (
                                    <span className="text-sm sm:text-base font-medium leading-snug bg-gradient-to-r from-cyan-600 via-purple-500 to-cyan-600 dark:from-cyan-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift pl-16">
                                        {greeting}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

// Controls bar - compact, close to content
function HomeControls({
    editing,
    onToggleEdit,
    onSave,
    onCancel,
    layout,
    onLayoutChange,
}) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-end gap-1.5 mb-1">
            {/* Edit mode indicator */}
            {editing && (
                <span className="text-xs text-cyan-600 dark:text-cyan-400 mr-1 hidden sm:inline">
                    {t("Editing...")}
                </span>
            )}

            {/* Layout toggle (only when not editing) */}
            {!editing && (
                <button
                    onClick={() =>
                        onLayoutChange(
                            layout === "single" ? "double" : "single",
                        )
                    }
                    className="p-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 hover:border-cyan-300/50 dark:hover:border-cyan-500/30 transition-all duration-200 group hidden sm:flex"
                    title={
                        layout === "single"
                            ? t("Switch to two-column layout")
                            : t("Switch to single-column layout")
                    }
                >
                    {layout === "single" ? (
                        <LayoutGrid className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                    ) : (
                        <Square className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                    )}
                </button>
            )}

            {editing ? (
                <>
                    <button
                        onClick={onCancel}
                        className="p-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200/50 dark:border-gray-700/50 transition-all duration-200"
                        title={t("Cancel")}
                    >
                        <X className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    </button>
                    <button
                        onClick={onSave}
                        className="p-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 shadow-sm shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200"
                        title={t("Save changes")}
                    >
                        <Check className="h-3.5 w-3.5 text-white" />
                    </button>
                </>
            ) : (
                <button
                    onClick={onToggleEdit}
                    className="p-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 hover:border-cyan-300/50 dark:hover:border-cyan-500/30 transition-all duration-200 group"
                    title={t("Edit dashboard")}
                >
                    <Pencil className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                </button>
            )}
        </div>
    );
}

// Empty state with call to action
function EmptyState({ onAddBlock }) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="relative mb-8">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/20 to-purple-400/20 blur-2xl scale-150" />
                <div className="relative p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 dark:border-cyan-500/30">
                    <Sparkles className="h-12 w-12 text-cyan-500 dark:text-cyan-400" />
                </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3 text-center">
                {t("Welcome to your dashboard")}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
                {t(
                    "Create AI-powered blocks to get personalized insights, summaries, and updates from your entities.",
                )}
            </p>

            <button
                onClick={onAddBlock}
                className="
                    group flex items-center gap-2 px-6 py-3 rounded-xl
                    bg-gradient-to-r from-cyan-500 to-purple-500
                    hover:from-cyan-400 hover:to-purple-400
                    text-white font-medium
                    shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40
                    transition-all duration-300
                    hover:scale-105 active:scale-100
                "
            >
                <PlusIcon className="h-5 w-5" />
                {t("Create your first block")}
            </button>
        </div>
    );
}

// Sortable wrapper for blocks in edit mode
function SortableBlock({ id, children }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : "auto",
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group">
            {/* Drag handle - inside block, top-left */}
            <button
                {...attributes}
                {...listeners}
                className="
                    absolute left-2 top-2 z-10
                    p-1.5 rounded-lg cursor-grab active:cursor-grabbing
                    text-gray-400 hover:text-cyan-600 dark:text-gray-500 dark:hover:text-cyan-400
                    bg-white/80 dark:bg-gray-800/80 hover:bg-cyan-50 dark:hover:bg-cyan-900/30
                    border border-gray-200/50 dark:border-gray-700/50
                    shadow-sm
                    transition-all opacity-0 group-hover:opacity-100
                    touch-none
                    sm:flex hidden
                "
                title="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            {children}
        </div>
    );
}

export default function DigestBlockList() {
    const { data: digest } = useCurrentUserDigest();
    const { data: user } = useCurrentUser();
    const { data: entities } = useDigestEntities();
    const updateCurrentUserDigest = useUpdateCurrentUserDigest();
    const [editing, setEditing] = useState(false);
    const [editedBlocks, setEditedBlocks] = useState([]);
    const { t } = useTranslation();

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Filter to non-system entities that user has in contacts
    const availableEntities = useMemo(() => {
        if (!entities) return [];
        return entities.filter((e) => !e.isSystem);
    }, [entities]);

    // Sync edited blocks when entering edit mode or digest changes
    useEffect(() => {
        if (digest?.blocks) {
            setEditedBlocks(digest.blocks.map((b, i) => ({ ...b, _index: i })));
        }
    }, [digest?.blocks]);

    const handleStartEdit = () => {
        setEditedBlocks(digest.blocks.map((b, i) => ({ ...b, _index: i })));
        setEditing(true);
    };

    const handleCancelEdit = () => {
        setEditedBlocks(digest.blocks.map((b, i) => ({ ...b, _index: i })));
        setEditing(false);
    };

    const handleSaveEdit = () => {
        // Remove internal _index before saving
        const blocksToSave = editedBlocks.map(({ _index, ...block }) => block);
        updateCurrentUserDigest.mutateAsync({ blocks: blocksToSave });
        setEditing(false);
    };

    const handleBlockChange = (index, updatedBlock) => {
        setEditedBlocks((prev) =>
            prev.map((b, i) =>
                i === index ? { ...updatedBlock, _index: i } : b,
            ),
        );
    };

    const handleDeleteBlock = (index) => {
        setEditedBlocks((prev) => prev.filter((_, i) => i !== index));
    };

    const handleAddBlock = () => {
        setEditedBlocks((prev) => [
            ...prev,
            {
                title: "",
                prompt: "",
                entityId: user?.defaultEntityId || "",
                _index: prev.length,
                _tempId: `new-${Date.now()}`,
            },
        ]);
    };

    const handleLayoutChange = (newLayout) => {
        updateCurrentUserDigest.mutate({ layout: newLayout });
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setEditedBlocks((prev) => {
                const oldIndex = prev.findIndex(
                    (b) => (b._id || b._tempId) === active.id,
                );
                const newIndex = prev.findIndex(
                    (b) => (b._id || b._tempId) === over.id,
                );
                return arrayMove(prev, oldIndex, newIndex);
            });
        }
    };

    // Get sortable IDs for blocks
    const sortableIds = useMemo(() => {
        return editedBlocks.map(
            (b) => b._id || b._tempId || `block-${b._index}`,
        );
    }, [editedBlocks]);

    if (!digest) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl animate-pulse" />
                    <Loader delay={0} />
                </div>
            </div>
        );
    }

    const layout = digest?.layout || "double";

    // Empty state
    if (!digest.blocks?.length && !editing) {
        return (
            <>
                <HomeControls
                    editing={false}
                    onToggleEdit={handleStartEdit}
                    layout={layout}
                    onLayoutChange={handleLayoutChange}
                />
                <HomeGreeting />
                <EmptyState
                    onAddBlock={() => {
                        updateCurrentUserDigest.mutateAsync({
                            blocks: [
                                {
                                    title: t("Daily digest"),
                                    prompt: t(
                                        "What's going on in the world today? Give me updates relevant to my interests.",
                                    ),
                                },
                            ],
                        });
                    }}
                />
            </>
        );
    }

    return (
        <>
            <HomeControls
                editing={editing}
                onToggleEdit={handleStartEdit}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                layout={layout}
                onLayoutChange={handleLayoutChange}
            />
            <HomeGreeting />

            {/* Blocks grid with responsive layout */}
            {editing ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sortableIds}
                        strategy={rectSortingStrategy}
                    >
                        <div
                            className={classNames(
                                "grid gap-4 sm:gap-6",
                                editedBlocks.length === 1
                                    ? "grid-cols-1"
                                    : "grid-cols-1 md:grid-cols-2",
                            )}
                        >
                            {editedBlocks.map((block, index) => (
                                <SortableBlock
                                    key={
                                        block._id ||
                                        block._tempId ||
                                        `block-${index}`
                                    }
                                    id={
                                        block._id ||
                                        block._tempId ||
                                        `block-${index}`
                                    }
                                >
                                    <DigestBlock
                                        block={block}
                                        entities={availableEntities}
                                        editing={true}
                                        onChange={(updated) =>
                                            handleBlockChange(index, updated)
                                        }
                                        onDelete={() =>
                                            handleDeleteBlock(index)
                                        }
                                    />
                                </SortableBlock>
                            ))}

                            {/* Add block button */}
                            <button
                                className="
                                    flex flex-col justify-center items-center 
                                    min-h-[200px] rounded-2xl 
                                    border-2 border-dashed border-gray-300 dark:border-gray-600 
                                    bg-gray-50/50 dark:bg-gray-800/30 
                                    hover:border-cyan-400 dark:hover:border-cyan-500 
                                    hover:bg-cyan-50/50 dark:hover:bg-cyan-900/20 
                                    transition-all duration-200 group
                                "
                                onClick={handleAddBlock}
                            >
                                <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40 transition-colors mb-2">
                                    <PlusIcon className="h-6 w-6 text-gray-400 dark:text-gray-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                                </div>
                                <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                    {t("Add block")}
                                </span>
                            </button>
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                <div
                    className={classNames(
                        "grid gap-4 sm:gap-6",
                        // Mobile is always single column, infinite scroll
                        // Desktop respects layout preference
                        layout === "single"
                            ? "grid-cols-1"
                            : "grid-cols-1 md:grid-cols-2",
                    )}
                >
                    {digest.blocks.map((block, index) => (
                        <DigestBlock
                            key={block._id || `block-${index}`}
                            block={block}
                            entities={availableEntities}
                            editing={false}
                            contentClassName={
                                // Mobile: always infinite scroll (no constraints)
                                // Desktop: single mode = no constraints, double mode = constrained
                                layout === "single"
                                    ? ""
                                    : "md:max-h-80 md:overflow-auto"
                            }
                        />
                    ))}
                </div>
            )}

            {/* Animation styles */}
            <style jsx global>{`
                @keyframes gradient-shift {
                    0% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                    100% {
                        background-position: 0% 50%;
                    }
                }
                .animate-gradient-shift {
                    animation: gradient-shift 6s ease infinite;
                }
                @keyframes pulse-slow {
                    0%,
                    100% {
                        opacity: 0.5;
                    }
                    50% {
                        opacity: 0.8;
                    }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 4s ease-in-out infinite;
                }
                @keyframes shimmer {
                    0% {
                        background-position: 200% 0;
                    }
                    100% {
                        background-position: -200% 0;
                    }
                }
                .animate-shimmer {
                    animation: shimmer 2s ease-in-out infinite;
                }
                @keyframes ticker {
                    0% {
                        transform: translateX(0%);
                    }
                    100% {
                        transform: translateX(-50%);
                    }
                }
                .animate-ticker {
                    animation: ticker 20s linear infinite;
                }
            `}</style>
        </>
    );
}

// Inline edit form for a single block
export function BlockEditForm({ block, entities, onChange }) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            {/* Title field */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                    {t("Title")}
                </label>
                <input
                    placeholder={t("e.g., Daily News Summary")}
                    className="
                        w-full px-3 py-2 rounded-lg
                        border border-gray-200 dark:border-gray-600
                        bg-white dark:bg-gray-700/50
                        text-gray-900 dark:text-gray-100
                        placeholder:text-gray-400 dark:placeholder:text-gray-500
                        focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500
                        transition-all duration-200 text-base md:text-sm
                    "
                    value={block.title || ""}
                    onChange={(e) =>
                        onChange({ ...block, title: e.target.value })
                    }
                />
            </div>

            {/* Entity selector */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                    <span className="flex items-center gap-1.5">
                        <Bot className="h-3 w-3" />
                        {t("AI Contact")}
                    </span>
                </label>
                <Select
                    value={block.entityId || "__default__"}
                    onValueChange={(newEntityId) => {
                        const actualEntityId =
                            newEntityId === "__default__" ? "" : newEntityId;
                        const entity = entities?.find(
                            (e) => e.id === actualEntityId,
                        );
                        onChange({
                            ...block,
                            entityId: actualEntityId,
                            entityName: entity?.name || "",
                        });
                    }}
                >
                    <SelectTrigger className="w-full h-9 rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-base md:text-sm">
                        <SelectValue placeholder={t("Use default entity")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__default__">
                            <span className="flex items-center gap-2 text-gray-500">
                                <Sparkles className="h-4 w-4" />
                                {t("Default")}
                            </span>
                        </SelectItem>
                        {entities?.map((entity) => (
                            <SelectItem key={entity.id} value={entity.id}>
                                <span className="flex items-center gap-2">
                                    {entity.avatar?.image?.url ? (
                                        <img
                                            src={entity.avatar.image.url}
                                            alt={entity.name}
                                            className="h-4 w-4 rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="h-4 w-4 rounded-full bg-gradient-to-br from-cyan-400 to-purple-400 flex items-center justify-center text-[10px] text-white">
                                            {entity.avatarText ||
                                                entity.name?.[0] ||
                                                "?"}
                                        </span>
                                    )}
                                    {entity.name}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Prompt field */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                    {t("Prompt")}
                </label>
                <textarea
                    placeholder={t("What would you like this block to show?")}
                    className="
                        w-full px-3 py-2 rounded-lg
                        border border-gray-200 dark:border-gray-600
                        bg-white dark:bg-gray-700/50
                        text-gray-900 dark:text-gray-100
                        placeholder:text-gray-400 dark:placeholder:text-gray-500
                        focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500
                        transition-all duration-200 resize-none text-base md:text-sm
                    "
                    rows={3}
                    value={block.prompt || ""}
                    onChange={(e) =>
                        onChange({ ...block, prompt: e.target.value })
                    }
                />
            </div>
        </div>
    );
}
