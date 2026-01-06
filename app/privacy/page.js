"use client";

import { useContext } from "react";
import { LanguageContext } from "../../src/contexts/LanguageProvider";
import config from "../../config";
import Script from "next/script";
import { useEffect } from "react";
import AnimatedLogo from "../../src/components/common/AnimatedLogo";

export default function PrivacyNoticePage() {
    const { language } = useContext(LanguageContext);
    const { getPrivacyContent } = config.global;

    const data = getPrivacyContent(language);
    const {
        markup,
        scripts = [],
        noticeUrls = [],
    } = data && data.markup
        ? data
        : { markup: data, scripts: [], noticeUrls: [] };

    useEffect(() => {
        if (!noticeUrls.length) return;

        function tryLoad() {
            if (window.OneTrust?.NoticeApi?.Initialized) {
                window.OneTrust.NoticeApi.Initialized.then(function () {
                    window.OneTrust.NoticeApi.LoadNotices(noticeUrls);
                });
                return true;
            }
            return false;
        }

        if (!tryLoad()) {
            const i = setInterval(() => {
                if (tryLoad()) clearInterval(i);
            }, 300);
            return () => clearInterval(i);
        }
    }, [noticeUrls]);

    const lastUpdated = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <div className="min-h-screen">
            {/* Render dynamic scripts from config */}
            {scripts.map((s) => (
                <Script
                    key={s.id || s.src}
                    src={s.src}
                    id={s.id}
                    strategy={s.strategy || "afterInteractive"}
                    {...(s.attrs || {})}
                />
            ))}

            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {/* Header with Animated Logo */}
                    <div className="flex flex-col items-center mb-12 pb-8 border-b border-gray-200 dark:border-gray-700">
                        <div className="mb-4">
                            <AnimatedLogo size={140} animate={true} />
                        </div>
                        <div className="text-center">
                            <h1 className="chat-message text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                Privacy Policy
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Last updated: {lastUpdated}
                            </p>
                        </div>
                    </div>

                    {/* Content with chat-message styling */}
                    <div className="chat-message">{markup}</div>
                </div>
            </div>
        </div>
    );
}
