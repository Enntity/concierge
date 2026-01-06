"use client";

import i18next from "i18next";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import config from "../../config";
import { ThemeContext } from "../contexts/ThemeProvider";
import AnimatedLogo from "./common/AnimatedLogo";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";

const Tos = ({ showTos, setShowTos }) => {
    const { getTosContent } = config.global;
    const { language } = i18next;
    const { t } = useTranslation();
    const tosContent = getTosContent(language);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

    const handleTosClose = () => {
        setHasScrolledToBottom(false);
        setShowTos(false);
        const rightNow = new Date(Date.now());
        localStorage.setItem("cortexWebShowTos", rightNow.toString());
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        // More forgiving scroll detection - allow 50px buffer from bottom
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

        if (isAtBottom) {
            setHasScrolledToBottom(true);
        }
    };

    const handlePrivacyLinkClick = (e) => {
        e.preventDefault();
        setShowTos(false);
        // Small delay to allow dialog to close before navigation
        setTimeout(() => {
            window.location.href = "/privacy";
        }, 100);
    };

    useEffect(() => {
        const shouldShowTos = checkShowTos();
        setShowTos(shouldShowTos);
    }, [setShowTos]);

    const checkShowTos = () => {
        const acceptDateString =
            typeof localStorage !== "undefined"
                ? localStorage.getItem("cortexWebShowTos")
                : null;

        if (acceptDateString && typeof acceptDateString === "string") {
            const acceptDate = new Date(acceptDateString);
            const thirtyDaysAgo = new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000,
            );
            if (acceptDate > thirtyDaysAgo) {
                return false;
            } else {
                return true;
            }
        } else {
            return true;
        }
    };

    return (
        <AlertDialog open={showTos} onOpenChange={setShowTos}>
            <AlertDialogContent className="max-h-[90vh] flex flex-col w-[90%] max-w-4xl z-50 bg-white dark:bg-gray-800 p-0">
                <AlertDialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex-shrink-0">
                            <AnimatedLogo size={100} animate={true} />
                        </div>
                        
                        {/* Scroll instruction - right under logo */}
                        <div
                            className={`w-full rounded-md p-3 ${
                                hasScrolledToBottom
                                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                                    : "bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800"
                            }`}
                        >
                            <div
                                className={`flex items-center gap-2 ${
                                    hasScrolledToBottom
                                        ? "text-green-700 dark:text-green-300"
                                        : "text-sky-700 dark:text-sky-300"
                                }`}
                            >
                                {hasScrolledToBottom ? (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                        />
                                    </svg>
                                )}
                                <span className="text-sm font-medium">
                                    {hasScrolledToBottom
                                        ? t("Terms of Service read completely")
                                        : t("Please scroll to the bottom to read the complete Terms of Service")}
                                </span>
                            </div>
                        </div>
                    </div>
                </AlertDialogHeader>

                <AlertDialogDescription asChild>
                    <div className="flex flex-col flex-1 min-h-0 px-6 pb-4">
                        <div
                            className="chat-message flex-1 overflow-y-auto pr-4 border-2 border-gray-200 dark:border-gray-700 rounded-md p-6 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800"
                            onScroll={handleScroll}
                        >
                            {/* Title and date inside scrollable region */}
                            <div className="text-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                                <h1 className="chat-message text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    {t("Terms of Service")}
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            
                            {tosContent}
                            
                            {/* Privacy policy link at bottom of scrollable content */}
                            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <p className="chat-message text-sm">
                                    {t("For more information, please review our")}{" "}
                                    <a
                                        href="/privacy"
                                        onClick={handlePrivacyLinkClick}
                                        className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 underline"
                                    >
                                        {t("Privacy Policy")}
                                    </a>
                                    .
                                </p>
                            </div>
                        </div>
                    </div>
                </AlertDialogDescription>

                <AlertDialogFooter className="px-6 pb-6 flex-shrink-0">
                    <AlertDialogAction
                        onClick={handleTosClose}
                        disabled={!hasScrolledToBottom}
                        className={
                            !hasScrolledToBottom
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                        }
                    >
                        {t("I Accept")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default Tos;
