import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FileContentArea from "../FileContentArea";

jest.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

jest.mock("react-toastify", () => ({
    toast: {
        error: jest.fn(),
    },
}));

jest.mock("i18next", () => ({
    language: "en",
}));

jest.mock("lucide-react", () => {
    const Icon = () => <span />;
    return {
        ArrowUpDown: Icon,
        ChevronUp: Icon,
        ChevronDown: Icon,
        Check: Icon,
        Loader2: Icon,
        Eye: Icon,
        Trash2: Icon,
    };
});

jest.mock(
    "../../../../utils/mediaUtils",
    () => ({
        getFileIcon: () => () => <span data-testid="file-icon" />,
    }),
    { virtual: true },
);

jest.mock(
    "@/components/ui/table",
    () => ({
        Table: ({ children }) => <table>{children}</table>,
        TableBody: ({ children }) => <tbody>{children}</tbody>,
        TableCell: ({ children, ...props }) => <td {...props}>{children}</td>,
        TableHead: ({ children, ...props }) => <th {...props}>{children}</th>,
        TableHeader: ({ children }) => <thead>{children}</thead>,
        TableRow: ({ children, ...props }) => <tr {...props}>{children}</tr>,
    }),
    { virtual: true },
);

jest.mock(
    "../../FileManager",
    () => ({
        __esModule: true,
        getFilename: (file) => file.displayFilename || file.filename || "",
        getFileDate: (file) => new Date(file.modifiedDate),
        formatFileSize: () => "1 KB",
        HoverPreview: () => null,
    }),
    { virtual: true },
);

jest.mock(
    "../../../../utils/fileDownloadUtils",
    () => ({
        __esModule: true,
        INVALID_FILENAME_CHARS: /[\\/:*?"<>|]/,
    }),
    { virtual: true },
);

describe("FileContentArea selection callbacks", () => {
    it("passes the sorted visible file order back to the selection handler", () => {
        const files = [
            {
                _id: "older",
                displayFilename: "Older.txt",
                modifiedDate: "2026-01-01T00:00:00.000Z",
            },
            {
                _id: "newer",
                displayFilename: "Newer.txt",
                modifiedDate: "2026-03-01T00:00:00.000Z",
            },
        ];
        const onSelectFile = jest.fn();

        render(
            <FileContentArea
                files={files}
                selectedIds={new Set()}
                getFileId={(file) => file._id}
                onSelectFile={onSelectFile}
                onSelectAll={jest.fn()}
            />,
        );

        const rows = screen.getAllByRole("row");
        const newerRow = rows.find((row) =>
            row.textContent.includes("Newer.txt"),
        );
        fireEvent.click(newerRow);

        expect(onSelectFile).toHaveBeenCalledTimes(1);
        expect(onSelectFile.mock.calls[0][0]).toBe(files[1]);
        expect(onSelectFile.mock.calls[0][1].map((file) => file._id)).toEqual([
            "newer",
            "older",
        ]);
        expect(onSelectFile.mock.calls[0][2]).toBe(0);
    });
});
