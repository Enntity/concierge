import { Info } from "lucide-react";
import React from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import classNames from "../../../app/utils/class-names";

export const normalizeConversationModeData = (value) => {
    if (!value) return null;
    const mode = String(value.mode || value.conversationMode || "").trim();
    if (!mode) return null;
    const routeMode = String(value.routeMode || "").trim();
    const routeReason = String(value.routeReason || value.reason || "").trim();
    const routeSource = String(value.routeSource || value.source || "").trim();
    const directTool = String(value.directTool || "").trim();

    const normalizeLabel = (input = "") =>
        input
            .replace(/_/g, " ")
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase());

    return {
        mode,
        label: value.label || normalizeLabel(mode),
        routeMode: routeMode || null,
        routeLabel: routeMode ? normalizeLabel(routeMode) : null,
        routeReason: routeReason || null,
        routeReasonLabel: routeReason ? normalizeLabel(routeReason) : null,
        routeSource: routeSource || null,
        directTool: directTool || null,
    };
};

export const getConversationModeBadgeClasses = (mode = "") => {
    switch (String(mode).toLowerCase()) {
        case "research":
            return "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
        case "agentic":
            return "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
        case "creative":
            return "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300";
        case "nsfw":
            return "border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-300";
        default:
            return "border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300";
    }
};

export const ConversationModeInfoButton = React.memo(
    function ConversationModeInfoButton({ modeData, className = "" }) {
        const normalized = normalizeConversationModeData(modeData);
        if (!normalized) return null;

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-label="View detected mode"
                        title="View detected mode"
                        className={classNames(
                            className,
                            "text-gray-500 hover:text-sky-500 dark:hover:text-sky-400 transition-colors",
                        )}
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-64 p-3">
                    <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                            Detected mode
                        </div>
                        <div className="flex">
                            <span
                                className={classNames(
                                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                                    getConversationModeBadgeClasses(
                                        normalized.mode,
                                    ),
                                )}
                            >
                                {normalized.label}
                            </span>
                        </div>
                        {normalized.routeMode ? (
                            <>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                    Execution path
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                                        {normalized.routeLabel}
                                    </span>
                                    {normalized.directTool ? (
                                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300">
                                            {normalized.directTool}
                                        </span>
                                    ) : null}
                                </div>
                                {normalized.routeReasonLabel ||
                                normalized.routeSource ? (
                                    <div className="text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                                        {normalized.routeReasonLabel
                                            ? `Reason: ${normalized.routeReasonLabel}`
                                            : null}
                                        {normalized.routeReasonLabel &&
                                        normalized.routeSource
                                            ? " · "
                                            : null}
                                        {normalized.routeSource
                                            ? `Source: ${normalized.routeSource}`
                                            : null}
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                </PopoverContent>
            </Popover>
        );
    },
);

ConversationModeInfoButton.displayName = "ConversationModeInfoButton";
