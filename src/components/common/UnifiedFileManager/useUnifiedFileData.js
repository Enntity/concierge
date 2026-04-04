"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { listUserFolder } from "../../../utils/fileUploadUtils";

function ensureFolderPath(tree, path) {
    if (!path) return tree;

    const parts = path.split("/").filter(Boolean);
    let current = tree;
    let currentPath = "";

    for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!current.children[part]) {
            current.children[part] = {
                name: part,
                children: {},
                files: [],
                path: currentPath,
            };
        }
        current = current.children[part];
    }

    return current;
}

export function buildFolderTree(files, userPrefix, currentChatId = null) {
    const tree = { name: "/", children: {}, files: [], path: "" };

    for (const file of files) {
        let relativePath = file.blobPath || "";
        if (relativePath.startsWith(userPrefix)) {
            relativePath = relativePath.slice(userPrefix.length);
        }
        if (relativePath.startsWith("/")) {
            relativePath = relativePath.slice(1);
        }

        const parts = relativePath.split("/").filter(Boolean);
        const fileName = parts.pop();
        if (!fileName) {
            continue;
        }

        let current = tree;
        let currentPath = "";
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!current.children[part]) {
                current.children[part] = {
                    name: part,
                    children: {},
                    files: [],
                    path: currentPath,
                };
            }
            current = current.children[part];
        }

        current.files.push({
            ...file,
            blobPath: file.blobPath || null,
            displayName: decodeURIComponent(file.filename || fileName),
        });
    }

    if (currentChatId) {
        ensureFolderPath(tree, `chats/${currentChatId}`);
    }

    return tree;
}

export function countFiles(node) {
    let count = node.files.length;
    for (const child of Object.values(node.children)) {
        count += countFiles(child);
    }
    return count;
}

export function collectAllFiles(node) {
    let result = [...node.files];
    for (const child of Object.values(node.children)) {
        result = result.concat(collectAllFiles(child));
    }
    return result;
}

function findNodeByPath(tree, path) {
    if (!path) return tree;
    const parts = path.split("/");
    let current = tree;
    for (const part of parts) {
        if (!current.children[part]) return null;
        current = current.children[part];
    }
    return current;
}

export function useUnifiedFileData({
    contextId,
    chatId = null,
    reloadToken = 0,
}) {
    const userId = contextId;
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const loadingRef = useRef(false);
    const mountedRef = useRef(true);

    const loadFiles = useCallback(async () => {
        if (!userId || loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const loadedFiles = await listUserFolder(userId);
            if (mountedRef.current) {
                setFiles(
                    loadedFiles.map((file) => ({
                        ...file,
                        blobPath: file.blobPath || null,
                    })),
                );
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err.message);
                setFiles([]);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
            loadingRef.current = false;
        }
    }, [userId]);

    useEffect(() => {
        mountedRef.current = true;
        loadFiles();
        return () => {
            mountedRef.current = false;
        };
    }, [loadFiles, reloadToken]);

    const userPrefix = useMemo(() => (userId ? `${userId}/` : ""), [userId]);

    const tree = useMemo(
        () => buildFolderTree(files, userPrefix, chatId),
        [files, userPrefix, chatId],
    );

    const getFilesRecursive = useCallback(
        (path) => {
            if (!path && path !== "") return files;
            if (path === "") return collectAllFiles(tree);
            const node = findNodeByPath(tree, path);
            if (!node) return [];
            return collectAllFiles(node);
        },
        [tree, files],
    );

    const removeFileOptimistically = useCallback((file) => {
        const fileKey = file?.blobPath;
        setFiles((prev) => prev.filter((entry) => entry.blobPath !== fileKey));
    }, []);

    const renameFileOptimistically = useCallback((file, newName) => {
        const fileKey = file?.blobPath;
        setFiles((prev) =>
            prev.map((entry) => {
                if (entry.blobPath !== fileKey) {
                    return entry;
                }

                const nextBlobPath = fileKey
                    ? `${fileKey.split("/").slice(0, -1).join("/")}/${newName}`
                    : fileKey;

                return {
                    ...entry,
                    filename: newName,
                    displayFilename: newName,
                    blobPath: nextBlobPath,
                };
            }),
        );
    }, []);

    const togglePermanentOptimistically = useCallback((file) => {
        const fileKey = file?.blobPath;
        setFiles((prev) =>
            prev.map((entry) => {
                if (entry.blobPath !== fileKey) {
                    return entry;
                }
                return { ...entry, permanent: !entry?.permanent };
            }),
        );
    }, []);

    const getSnapshot = useCallback(() => [...files], [files]);
    const revertToSnapshot = useCallback((snapshot) => {
        setFiles(snapshot);
    }, []);

    return {
        tree,
        allFiles: files,
        loading,
        error,
        reloadFiles: loadFiles,
        totalFileCount: files.length,
        getFilesRecursive,
        removeFileOptimistically,
        renameFileOptimistically,
        togglePermanentOptimistically,
        getSnapshot,
        revertToSnapshot,
    };
}
