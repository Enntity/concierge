"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    ChevronRight,
    ChevronDown,
    Folder,
    FolderOpen,
    Globe,
    MessageSquare,
    FolderRoot,
    Image as ImageIcon,
    UserRound,
} from "lucide-react";
import { countFiles } from "./useUnifiedFileData";

function getFolderLabel(segment, chatTitleMap, t) {
    if (segment === "global") return t("Global Files");
    if (segment === "chats") return t("Chat Files");
    if (segment === "media") return t("Media");
    if (segment === "profile") return t("Profile");
    if (chatTitleMap && chatTitleMap[segment]) {
        return chatTitleMap[segment];
    }
    return segment;
}

function getFolderIcon(segment, isOpen) {
    if (segment === "global") {
        return <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
    if (segment === "chats") {
        return (
            <MessageSquare className="w-4 h-4 text-green-500 flex-shrink-0" />
        );
    }
    if (segment === "media") {
        return <ImageIcon className="w-4 h-4 text-pink-500 flex-shrink-0" />;
    }
    if (segment === "profile") {
        return <UserRound className="w-4 h-4 text-indigo-500 flex-shrink-0" />;
    }
    if (isOpen) {
        return <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
    }
    return <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
}

function SidebarFolderNode({
    segment,
    node,
    depth,
    chatTitleMap,
    isExpanded,
    isSelected,
    onToggleExpand,
    onSelect,
}) {
    const { t } = useTranslation();
    const childFolders = useMemo(
        () => Object.keys(node.children).sort(),
        [node.children],
    );
    const hasChildren = childFolders.length > 0;
    const expanded = isExpanded(node.path);
    const selected = isSelected(node.path);
    const fileCount = countFiles(node);

    return (
        <div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node.path);
                    if (hasChildren && !expanded) {
                        onToggleExpand(node.path);
                    }
                }}
                className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded text-sm transition-colors min-w-0 overflow-hidden ${
                    selected
                        ? "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
                style={{ paddingInlineStart: `${depth * 14 + 8}px` }}
            >
                {hasChildren ? (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(node.path);
                        }}
                        className="flex-shrink-0 p-0.5 -m-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                        {expanded ? (
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                        ) : (
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                        )}
                    </span>
                ) : (
                    <span className="w-3 flex-shrink-0" />
                )}
                {getFolderIcon(segment, expanded)}
                <span className="truncate font-medium">
                    {getFolderLabel(segment, chatTitleMap, t)}
                </span>
                <span className="text-[10px] text-gray-400 ms-auto flex-shrink-0 tabular-nums">
                    {fileCount}
                </span>
            </button>

            {expanded && hasChildren && (
                <div>
                    {childFolders.map((childKey) => (
                        <SidebarFolderNode
                            key={childKey}
                            segment={childKey}
                            node={node.children[childKey]}
                            depth={depth + 1}
                            chatTitleMap={chatTitleMap}
                            isExpanded={isExpanded}
                            isSelected={isSelected}
                            onToggleExpand={onToggleExpand}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function SidebarFolderTree({
    tree,
    chatTitleMap = {},
    totalFileCount = 0,
    isExpanded,
    isSelected,
    onToggleExpand,
    onSelect,
}) {
    const { t } = useTranslation();
    const topFolders = useMemo(
        () => Object.keys(tree.children).sort(),
        [tree.children],
    );
    const rootSelected = isSelected("");

    return (
        <div className="flex flex-col overflow-y-auto overflow-x-hidden py-1 min-w-0">
            <button
                onClick={() => onSelect("")}
                className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded text-sm transition-colors min-w-0 overflow-hidden ${
                    rootSelected
                        ? "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
                style={{ paddingInlineStart: "8px" }}
            >
                <span className="w-3 flex-shrink-0" />
                <FolderRoot className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="truncate font-medium">{t("All Files")}</span>
                <span className="text-[10px] text-gray-400 ms-auto flex-shrink-0 tabular-nums">
                    {totalFileCount}
                </span>
            </button>

            {topFolders.map((folderKey) => (
                <SidebarFolderNode
                    key={folderKey}
                    segment={folderKey}
                    node={tree.children[folderKey]}
                    depth={1}
                    chatTitleMap={chatTitleMap}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    onToggleExpand={onToggleExpand}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}
