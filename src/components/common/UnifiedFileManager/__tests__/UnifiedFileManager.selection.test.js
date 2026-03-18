import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import UnifiedFileManager from "../UnifiedFileManager";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

jest.mock("react-toastify", () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
    },
}));

jest.mock(
    "../../../images/hooks/useItemSelection",
    () => {
        const React = require("react");

        return {
            __esModule: true,
            useItemSelection: (getItemId) => {
                const [selectedIds, setSelectedIds] = React.useState(
                    () => new Set(),
                );
                const [selectedObjects, setSelectedObjects] = React.useState(
                    [],
                );
                const [lastSelectedId, setLastSelectedId] =
                    React.useState(null);

                const clearSelection = React.useCallback(() => {
                    setSelectedIds(new Set());
                    setSelectedObjects([]);
                    setLastSelectedId(null);
                }, []);

                const toggleSelection = React.useCallback(
                    (item) => {
                        const id = getItemId(item);

                        setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) {
                                next.delete(id);
                            } else {
                                next.add(id);
                            }
                            return next;
                        });

                        setSelectedObjects((prev) => {
                            const exists = prev.some(
                                (entry) => getItemId(entry) === id,
                            );
                            return exists
                                ? prev.filter(
                                      (entry) => getItemId(entry) !== id,
                                  )
                                : [...prev, item];
                        });
                    },
                    [getItemId],
                );

                const selectRange = React.useCallback(
                    (items, start, end) => {
                        setSelectedIds((prev) => {
                            const next = new Set(prev);
                            for (let index = start; index <= end; index += 1) {
                                const item = items[index];
                                if (item) {
                                    next.add(getItemId(item));
                                }
                            }
                            return next;
                        });

                        setSelectedObjects((prev) => {
                            const next = [...prev];
                            const seen = new Set(
                                prev.map((item) => getItemId(item)),
                            );
                            for (let index = start; index <= end; index += 1) {
                                const item = items[index];
                                if (item) {
                                    const id = getItemId(item);
                                    if (!seen.has(id)) {
                                        seen.add(id);
                                        next.push(item);
                                    }
                                }
                            }
                            return next;
                        });
                    },
                    [getItemId],
                );

                return {
                    selectedIds,
                    selectedObjects,
                    clearSelection,
                    toggleSelection,
                    selectRange,
                    setSelectedIds,
                    setSelectedObjects,
                    lastSelectedId,
                    setLastSelectedId,
                };
            },
        };
    },
    { virtual: true },
);

jest.mock("../useUnifiedFileData", () => {
    const files = [
        {
            _id: "middle",
            displayFilename: "Middle.txt",
            modifiedDate: "2026-02-15T00:00:00.000Z",
        },
        {
            _id: "oldest",
            displayFilename: "Oldest.txt",
            modifiedDate: "2026-01-15T00:00:00.000Z",
        },
        {
            _id: "newest",
            displayFilename: "Newest.txt",
            modifiedDate: "2026-03-01T00:00:00.000Z",
        },
    ];

    return {
        __esModule: true,
        collectAllFiles: (node) => node.files || [],
        useUnifiedFileData: () => ({
            tree: { files, children: {} },
            allFiles: files,
            loading: false,
            error: null,
            reloadFiles: jest.fn(),
            totalFileCount: files.length,
            getFilesRecursive: () => files,
            removeFileOptimistically: jest.fn(),
            renameFileOptimistically: jest.fn(),
            togglePermanentOptimistically: jest.fn(),
            getSnapshot: jest.fn(() => files),
            revertToSnapshot: jest.fn(),
        }),
    };
});

jest.mock("../useFolderNavigation", () => ({
    __esModule: true,
    useFolderNavigation: () => ({
        selectedPath: "",
        expandedPaths: new Set(),
        selectFolder: jest.fn(),
        toggleExpanded: jest.fn(),
        isExpanded: jest.fn(() => false),
        isSelected: jest.fn((path) => path === ""),
        breadcrumbs: [{ label: "All Files", path: "" }],
    }),
}));

jest.mock("../SidebarFolderTree", () => ({
    __esModule: true,
    default: () => <div data-testid="sidebar-tree" />,
}));

jest.mock("../FileToolbar", () => ({
    __esModule: true,
    default: () => <div data-testid="file-toolbar" />,
}));

jest.mock("../FileGridView", () => ({
    __esModule: true,
    default: () => <div data-testid="file-grid-view" />,
}));

jest.mock("../FileStatusBar", () => ({
    __esModule: true,
    default: ({ selectedCount }) => (
        <div data-testid="status-selected-count">{selectedCount}</div>
    ),
}));

jest.mock(
    "../../BulkActionsBar",
    () => ({
        __esModule: true,
        default: () => null,
    }),
    { virtual: true },
);

jest.mock(
    "../../EmptyState",
    () => ({
        __esModule: true,
        default: () => <div data-testid="empty-state" />,
    }),
    { virtual: true },
);

jest.mock(
    "@/components/ui/spinner",
    () => ({
        __esModule: true,
        Spinner: () => <div data-testid="spinner" />,
    }),
    { virtual: true },
);

jest.mock(
    "@/components/ui/alert-dialog",
    () => ({
        AlertDialog: ({ children }) => <div>{children}</div>,
        AlertDialogContent: ({ children }) => <div>{children}</div>,
        AlertDialogHeader: ({ children }) => <div>{children}</div>,
        AlertDialogTitle: ({ children }) => <div>{children}</div>,
        AlertDialogDescription: ({ children }) => <div>{children}</div>,
        AlertDialogFooter: ({ children }) => <div>{children}</div>,
        AlertDialogAction: ({ children, ...props }) => (
            <button type="button" {...props}>
                {children}
            </button>
        ),
        AlertDialogCancel: ({ children, ...props }) => (
            <button type="button" {...props}>
                {children}
            </button>
        ),
    }),
    { virtual: true },
);

jest.mock(
    "../../FileManager",
    () => ({
        __esModule: true,
        getFileUrl: jest.fn(() => null),
        getFilename: (file) =>
            file.displayFilename || file.displayName || file.filename || "",
        FilePreviewDialog: () => null,
    }),
    { virtual: true },
);

jest.mock(
    "../../../../utils/fileDownloadUtils",
    () => ({
        __esModule: true,
        downloadSingleFile: jest.fn(),
    }),
    { virtual: true },
);

jest.mock("../FileContentArea", () => ({
    __esModule: true,
    default: ({ files, selectedIds, onSelectFile }) => {
        const orderedFiles = [...files].sort(
            (a, b) =>
                new Date(b.modifiedDate).getTime() -
                new Date(a.modifiedDate).getTime(),
        );

        return (
            <div>
                <div data-testid="content-selected-count">
                    {selectedIds.size}
                </div>
                {orderedFiles.map((file, index) => (
                    <button
                        key={file._id}
                        type="button"
                        onClick={(event) =>
                            onSelectFile(file, orderedFiles, index, event)
                        }
                    >
                        {file.displayFilename}
                    </button>
                ))}
            </div>
        );
    },
}));

describe("UnifiedFileManager shift selection", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("selects the full visible range in list order", () => {
        render(
            <UnifiedFileManager
                contextId="ctx-1"
                onDownload={jest.fn()}
                containerHeight="400px"
            />,
        );

        expect(screen.getByTestId("content-selected-count")).toHaveTextContent(
            "0",
        );

        fireEvent.click(screen.getByRole("button", { name: "Newest.txt" }));
        expect(screen.getByTestId("content-selected-count")).toHaveTextContent(
            "1",
        );

        fireEvent.click(screen.getByRole("button", { name: "Oldest.txt" }), {
            shiftKey: true,
        });

        expect(screen.getByTestId("content-selected-count")).toHaveTextContent(
            "3",
        );
        expect(screen.getByTestId("status-selected-count")).toHaveTextContent(
            "3",
        );
    });
});
