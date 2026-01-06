import React from "react";
import { HighlightJS } from "highlight.js";
import CopyButton from "../CopyButton";

const CodeBlock = ({ code, language }) => {
    let highlightedCode = "";
    const trimmedCode = code?.trim() || "";

    if (language && HighlightJS.getLanguage(language)) {
        highlightedCode = HighlightJS.highlight(trimmedCode, {
            language: language,
        }).value;
    } else {
        highlightedCode = HighlightJS.highlightAuto(trimmedCode).value;
    }

    return (
        <div className="code-block my-3 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            {language && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {language}
                    </span>
                    <CopyButton
                        item={code}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    />
                </div>
            )}
            {!language && (
                <div className="absolute top-2 right-2">
                    <CopyButton
                        item={code}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    />
                </div>
            )}
            <pre className="p-3 overflow-x-auto text-[0.8125rem] leading-snug">
                <code
                    className="hljs"
                    dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
            </pre>
        </div>
    );
};

export default CodeBlock;
