"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Users,
    Layers,
    UserPlus,
    Package,
    MessageSquare,
    Heart,
    Loader2,
} from "lucide-react";

const TABS = [
    { value: "queues", label: "Queues", icon: Layers, path: "/admin/queues" },
    { value: "users", label: "Users", icon: Users, path: "/admin/users" },
    {
        value: "signup-requests",
        label: "Signups",
        icon: UserPlus,
        path: "/admin/signup-requests",
    },
    {
        value: "entities",
        label: "Entities",
        icon: Package,
        path: "/admin/entities",
    },
    {
        value: "pulse",
        label: "Pulse",
        icon: Heart,
        path: "/admin/pulse",
    },
    {
        value: "feedback",
        label: "Feedback",
        icon: MessageSquare,
        path: "/admin/feedback",
    },
];

export default function AdminTabs({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [pendingTab, setPendingTab] = useState(null);

    const activeTab =
        TABS.find((t) => pathname.startsWith(t.path))?.value || "queues";

    useEffect(() => {
        setPendingTab(null);
    }, [activeTab]);

    return (
        <div className="space-y-6">
            <Tabs
                value={pendingTab || activeTab}
                onValueChange={(v) => {
                    setPendingTab(v);
                    startTransition(() => {
                        router.push(`/admin/${v}`);
                    });
                }}
            >
                <TabsList className="inline-flex h-10 w-full items-end justify-start gap-1 border-b border-gray-200 dark:border-gray-700 !bg-transparent dark:!bg-transparent !p-0 overflow-x-auto">
                    {TABS.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger
                            key={value}
                            value={value}
                            className="flex items-center gap-2 px-3 sm:px-4 shrink-0 -mb-px rounded-t-md border border-transparent border-b-0 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:border-gray-200 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:border-gray-700"
                        >
                            <Icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{label}</span>
                            <span className="inline-flex w-4 justify-center">
                                <Loader2
                                    className={`h-3.5 w-3.5 animate-spin text-gray-400 ${
                                        isPending && pendingTab === value
                                            ? "opacity-100"
                                            : "opacity-0"
                                    }`}
                                />
                            </span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            {children}
        </div>
    );
}
