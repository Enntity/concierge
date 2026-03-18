"use client";

import { useState, useCallback, useMemo, useEffect } from "react";

export function useFolderNavigation({ tree, chatId = null }) {
    const [selectedPath, setSelectedPath] = useState("");
    const [expandedPaths, setExpandedPaths] = useState(new Set());

    useEffect(() => {
        if (chatId && tree) {
            const chatPath = `chats/${chatId}`;
            const hasChats = !!tree.children?.chats;
            const hasChatFolder =
                hasChats && !!tree.children.chats.children?.[chatId];

            if (hasChatFolder) {
                setSelectedPath(chatPath);
                setExpandedPaths(
                    (prev) => new Set([...prev, "chats", chatPath]),
                );
            } else if (hasChats) {
                setExpandedPaths((prev) => new Set([...prev, "chats"]));
            }
        }
    }, [chatId, tree]);

    useEffect(() => {
        if (tree && expandedPaths.size === 0) {
            const topLevelPaths = Object.keys(tree.children);
            if (topLevelPaths.length > 0) {
                setExpandedPaths(new Set(topLevelPaths));
            }
        }
    }, [tree]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectFolder = useCallback((path) => {
        setSelectedPath(path);
    }, []);

    const toggleExpanded = useCallback((path) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const isExpanded = useCallback(
        (path) => expandedPaths.has(path),
        [expandedPaths],
    );

    const isSelected = useCallback(
        (path) => selectedPath === path,
        [selectedPath],
    );

    const breadcrumbs = useMemo(() => {
        const crumbs = [{ label: "All Files", path: "" }];
        if (!selectedPath) return crumbs;

        const parts = selectedPath.split("/");
        let currentPath = "";
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            crumbs.push({ label: part, path: currentPath });
        }
        return crumbs;
    }, [selectedPath]);

    return {
        selectedPath,
        expandedPaths,
        selectFolder,
        toggleExpanded,
        isExpanded,
        isSelected,
        breadcrumbs,
    };
}
