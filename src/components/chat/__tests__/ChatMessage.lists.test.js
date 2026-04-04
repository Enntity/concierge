import React from "react";
import "@testing-library/jest-dom";
import { convertMessageToMarkdown } from "../ChatMessage";

jest.mock("react-markdown", () => {
    const React = require("react");
    return {
        __esModule: true,
        default: ({ children }) =>
            React.createElement("div", {
                "data-testid": "markdown",
                "data-children":
                    typeof children === "string" ? children : String(children),
            }),
    };
});

jest.mock("remark-directive", () => ({
    __esModule: true,
    default: () => () => {},
}));
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => () => {} }));
jest.mock("remark-math", () => ({ __esModule: true, default: () => () => {} }));
jest.mock("rehype-katex", () => ({
    __esModule: true,
    default: () => (tree) => tree,
}));
jest.mock("rehype-raw", () => ({
    __esModule: true,
    default: () => (tree) => tree,
}));
jest.mock("katex/dist/katex.min.css", () => ({}));
jest.mock("unist-util-visit", () => ({
    visit: (tree, type, visitor) => {
        const traverse = (node) => {
            if (!node) return;
            if (node.type === type && visitor) visitor(node);
            if (Array.isArray(type) && type.includes(node.type) && visitor) {
                visitor(node);
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        };
        traverse(tree);
    },
}));

jest.mock("i18next", () => ({
    t: jest.fn((key) => key),
    language: "en",
}));

jest.mock("../../code/CodeBlock", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("../TextWithCitations", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("../InlineEmotionDisplay", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("../MediaCard", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("../../code/MermaidDiagram", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("../../code/MermaidPlaceholder", () => ({
    __esModule: true,
    default: () => null,
}));

describe("ChatMessage plain text lists", () => {
    it("normalizes unicode bullets into markdown list markers", () => {
        const message = {
            payload:
                "Here’s your ultra-condensed need to know:\n\n• First item\n• Second item\n• Third item",
            tool: null,
        };

        const result = convertMessageToMarkdown(message);

        expect(result.props.children).toContain(
            "\n\n- First item\n- Second item\n- Third item",
        );
    });
});
