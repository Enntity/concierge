"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusIcon, Settings2, X, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Loader from "../../components/loader";
import {
    useCurrentUserDigest,
    useUpdateCurrentUserDigest,
} from "../../queries/digest";
import classNames from "../../utils/class-names";
import DigestBlock from "./DigestBlock";
import { convertMessageToMarkdown } from "../../../src/components/chat/ChatMessage";

export default function DigestBlockList() {
    const { data: digest } = useCurrentUserDigest();
    const updateCurrentUserDigest = useUpdateCurrentUserDigest();
    const [editing, setEditing] = useState(false);
    const { t } = useTranslation();

    if (!digest) {
        return <Loader />;
    }

    if (editing) {
        return (
            <DigestEditor
                value={digest.blocks}
                onCancel={() => setEditing(false)}
                onChange={(v) => {
                    updateCurrentUserDigest.mutateAsync({
                        blocks: v,
                    });

                    setEditing(false);
                }}
            />
        );
    }

    return (
        <>
            <div className="flex justify-between items-start mb-4 gap-8">
                {digest?.greeting && (
                    <div className="text-gray-700 dark:text-gray-300">
                        {convertMessageToMarkdown({ payload: digest.greeting })}
                    </div>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Settings2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={8}>
                        <DropdownMenuItem onClick={() => setEditing(true)}>
                            {t("Edit dashboard")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div
                className={classNames(
                    "grid gap-4",
                    digest.blocks.length > 1
                        ? "sm:grid-cols-2"
                        : "sm:grid-cols-1",
                )}
            >
                {digest.blocks.map((block, index) => (
                    <DigestBlock
                        key={block._id || block.id || `block-${index}`}
                        block={block}
                        contentClassName={
                            digest.blocks.length > 2
                                ? "max-h-64 overflow-auto"
                                : "max-h-[calc(100vh-350px)] overflow-auto"
                        }
                    />
                ))}
            </div>
        </>
    );
}

function DigestEditor({ value, onChange, onCancel }) {
    const [digestBlocks, setDigestBlocks] = useState(value || []);
    const { t } = useTranslation();

    useEffect(() => {
        setDigestBlocks(value);
    }, [value]);

    const handleSave = async () => {
        onChange(digestBlocks);
    };

    // assign ids based on index
    const blocks = digestBlocks.map((b, i) => {
        return {
            ...b,
            id: i,
        };
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 dark:from-cyan-500/30 dark:to-purple-500/30">
                    <Sparkles className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t("Edit dashboard")}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            "Configure the blocks that appear on your home page",
                        )}
                    </p>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                {blocks?.map((p) => (
                    <div
                        key={p.id}
                        className="group relative bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                        <button
                            onClick={() => {
                                setDigestBlocks(
                                    blocks.filter((d) => d.id !== p.id),
                                );
                            }}
                            className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title={t("Remove block")}
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <EditDigestBlock
                            value={p}
                            onChange={(v) => {
                                setDigestBlocks(
                                    blocks.map((d) => {
                                        if (d.id === p.id) {
                                            return v;
                                        }
                                        return d;
                                    }),
                                );
                            }}
                        />
                    </div>
                ))}

                <button
                    className="flex flex-col justify-center items-center min-h-[160px] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50 hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-cyan-50/50 dark:hover:bg-cyan-900/20 transition-all duration-200 group"
                    onClick={() => {
                        setDigestBlocks([
                            ...blocks,
                            {
                                title: "",
                                prompt: "",
                                id: blocks.length,
                            },
                        ]);
                    }}
                >
                    <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40 transition-colors mb-2">
                        <PlusIcon className="h-6 w-6 text-gray-400 dark:text-gray-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                        {t("Add block")}
                    </span>
                </button>
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium transition-colors"
                >
                    {t("Save changes")}
                </button>
                <button
                    onClick={() => {
                        setDigestBlocks(value);
                        onCancel();
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                    {t("Cancel")}
                </button>
            </div>
        </div>
    );
}

function EditDigestBlock({ value, onChange }) {
    const { t } = useTranslation();

    return (
        <div className="space-y-4 pt-4">
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    {t("Title")}
                </label>
                <input
                    placeholder={t("Block title...")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-shadow"
                    value={value.title}
                    onChange={(e) => {
                        onChange({
                            ...value,
                            title: e.target.value,
                        });
                    }}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    {t("Prompt")}
                </label>
                <textarea
                    placeholder={t("What would you like this block to show?")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-shadow resize-none"
                    rows={4}
                    value={value.prompt}
                    onChange={(e) => {
                        onChange({
                            ...value,
                            prompt: e.target.value,
                        });
                    }}
                />
            </div>
        </div>
    );
}
