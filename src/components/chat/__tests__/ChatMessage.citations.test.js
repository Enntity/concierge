import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { convertMessageToMarkdown } from "../ChatMessage";

// Mock react-markdown to parse :cd_source[...] directives
jest.mock("react-markdown", () => {
    const React = require("react");
    return {
        __esModule: true,
        default: ({ children, components }) => {
            const text =
                typeof children === "string" ? children : String(children);

            // Parse :cd_source[...] directives and call the component handler
            const parts = [];
            const regex = /:cd_source\[([^\]]*)\]/g;
            let lastIndex = 0;
            let match;
            let key = 0;

            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(text.slice(lastIndex, match.index));
                }
                if (components?.cd_source) {
                    const result = components.cd_source({
                        children: [match[1]],
                    });
                    if (result) {
                        parts.push(
                            React.createElement(
                                React.Fragment,
                                { key: key++ },
                                result,
                            ),
                        );
                    }
                }
                lastIndex = regex.lastIndex;
            }

            if (lastIndex < text.length) {
                parts.push(text.slice(lastIndex));
            }

            return React.createElement(
                "div",
                { "data-testid": "markdown" },
                ...parts,
            );
        },
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
            if (Array.isArray(type) && type.includes(node.type) && visitor)
                visitor(node);
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
    default: ({ code, language }) => (
        <pre data-testid="code-block" data-language={language}>
            {code}
        </pre>
    ),
}));

jest.mock("../TextWithCitations", () => ({
    __esModule: true,
    default: ({ index, citation }) => (
        <span
            data-testid="citation"
            data-index={index}
            data-url={citation?.url || ""}
            data-title={citation?.title || ""}
        >
            [{index}]
        </span>
    ),
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

describe("ChatMessage URL Citations", () => {
    const renderMessage = (payload, citations = null) => {
        const message = {
            payload,
            tool: citations ? JSON.stringify({ citations }) : null,
        };
        const result = convertMessageToMarkdown(message);
        return render(result);
    };

    // Helper to get the cd_source handler and call it directly,
    // simulating what happens when GFM autolink wraps the URL in <a>.
    const getCdSourceHandler = (citations = null) => {
        const message = {
            payload: "test",
            tool: citations ? JSON.stringify({ citations }) : null,
        };
        const element = convertMessageToMarkdown(message);
        return element.props.components.cd_source;
    };

    describe("URL-only cd_source directives", () => {
        it("should render a URL citation with hostname as title", () => {
            const { container } = renderMessage(
                "Check this :cd_source[https://example.com/article] for details.",
            );
            const citation = container.querySelector(
                '[data-testid="citation"]',
            );
            expect(citation).toBeTruthy();
            expect(citation.getAttribute("data-url")).toBe(
                "https://example.com/article",
            );
            expect(citation.getAttribute("data-title")).toBe("example.com");
            expect(citation.getAttribute("data-index")).toBe("1");
        });

        it("should strip www. from hostname", () => {
            const { container } = renderMessage(
                "See :cd_source[https://www.cnn.com/politics/live-news/epstein-files-release-doj-01-30-26] here.",
            );
            const citation = container.querySelector(
                '[data-testid="citation"]',
            );
            expect(citation).toBeTruthy();
            expect(citation.getAttribute("data-title")).toBe("cnn.com");
            expect(citation.getAttribute("data-url")).toBe(
                "https://www.cnn.com/politics/live-news/epstein-files-release-doj-01-30-26",
            );
        });

        it("should handle http URLs", () => {
            const { container } = renderMessage(
                "Source: :cd_source[http://example.org/page]",
            );
            const citation = container.querySelector(
                '[data-testid="citation"]',
            );
            expect(citation).toBeTruthy();
            expect(citation.getAttribute("data-url")).toBe(
                "http://example.org/page",
            );
            expect(citation.getAttribute("data-title")).toBe("example.org");
        });

        it("should assign sequential indices to multiple URL citations", () => {
            const { container } = renderMessage(
                "First :cd_source[https://a.com/1] and second :cd_source[https://b.com/2] here.",
            );
            const citations = container.querySelectorAll(
                '[data-testid="citation"]',
            );
            expect(citations).toHaveLength(2);
            expect(citations[0].getAttribute("data-index")).toBe("1");
            expect(citations[0].getAttribute("data-url")).toBe(
                "https://a.com/1",
            );
            expect(citations[1].getAttribute("data-index")).toBe("2");
            expect(citations[1].getAttribute("data-url")).toBe(
                "https://b.com/2",
            );
        });
    });

    describe("URL citations mixed with index citations", () => {
        it("should assign URL indices after existing citation indices", () => {
            const existingCitations = [
                {
                    title: "First Source",
                    url: "https://first.com",
                    content: "content1",
                },
                {
                    title: "Second Source",
                    url: "https://second.com",
                    content: "content2",
                },
            ];
            const { container } = renderMessage(
                "See :cd_source[1] and :cd_source[2] and also :cd_source[https://third.com/article] here.",
                existingCitations,
            );
            const citations = container.querySelectorAll(
                '[data-testid="citation"]',
            );
            expect(citations).toHaveLength(3);
            // Index citations keep their original indices
            expect(citations[0].getAttribute("data-index")).toBe("1");
            expect(citations[1].getAttribute("data-index")).toBe("2");
            // URL citation gets index 3 (after the 2 existing citations)
            expect(citations[2].getAttribute("data-index")).toBe("3");
            expect(citations[2].getAttribute("data-url")).toBe(
                "https://third.com/article",
            );
        });
    });

    describe("URL citations matching existing citations", () => {
        it("should reuse an existing citation when URL matches", () => {
            const existingCitations = [
                {
                    title: "CNN Article",
                    url: "https://www.cnn.com/article",
                    content: "some content",
                },
                {
                    title: "BBC Article",
                    url: "https://bbc.com/news",
                    content: "other content",
                },
            ];
            const { container } = renderMessage(
                "Check :cd_source[https://bbc.com/news] for more.",
                existingCitations,
            );
            const citation = container.querySelector(
                '[data-testid="citation"]',
            );
            expect(citation).toBeTruthy();
            // Should reuse the existing citation at index 2, not create a new one
            expect(citation.getAttribute("data-index")).toBe("2");
            expect(citation.getAttribute("data-title")).toBe("BBC Article");
        });
    });

    describe("GFM autolink resilience", () => {
        it("should handle children wrapped in an <a> element by GFM autolink", () => {
            const cdSource = getCdSourceHandler();
            // Simulate GFM autolink: children is a React <a> element
            const link = React.createElement(
                "a",
                { href: "https://www.cnn.com/politics/article" },
                "https://www.cnn.com/politics/article",
            );
            const result = cdSource({ children: link });
            const { container } = render(result);
            const citation = container.querySelector(
                '[data-testid="citation"]',
            );
            expect(citation).toBeTruthy();
            expect(citation.getAttribute("data-url")).toBe(
                "https://www.cnn.com/politics/article",
            );
            expect(citation.getAttribute("data-title")).toBe("cnn.com");
        });

        it("should handle children as an array containing an <a> element", () => {
            const cdSource = getCdSourceHandler();
            const link = React.createElement(
                "a",
                { href: "https://example.com/page" },
                "https://example.com/page",
            );
            const result = cdSource({ children: [link] });
            const { container } = render(result);
            const citation = container.querySelector(
                '[data-testid="citation"]',
            );
            expect(citation).toBeTruthy();
            expect(citation.getAttribute("data-url")).toBe(
                "https://example.com/page",
            );
            expect(citation.getAttribute("data-title")).toBe("example.com");
        });
    });

    describe("Non-URL content should not match", () => {
        it("should return null for plain text that is not a URL or valid index", () => {
            const { container } = renderMessage(
                "Some :cd_source[random-text] here.",
            );
            const citation = container.querySelector(
                '[data-testid="citation"]',
            );
            expect(citation).toBeNull();
        });

        it("should return null for an index with no citations", () => {
            const { container } = renderMessage("Some :cd_source[5] here.");
            const citation = container.querySelector(
                '[data-testid="citation"]',
            );
            expect(citation).toBeNull();
        });
    });
});
