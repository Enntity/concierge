"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Layers, UserPlus } from "lucide-react";

const TABS = [
    { value: "queues", label: "Queues", icon: Layers, path: "/admin/queues" },
    { value: "users", label: "Users", icon: Users, path: "/admin/users" },
    {
        value: "signup-requests",
        label: "Signups",
        icon: UserPlus,
        path: "/admin/signup-requests",
    },
];

export default function AdminTabs({ children }) {
    const pathname = usePathname();
    const router = useRouter();

    const activeTab =
        TABS.find((t) => pathname.startsWith(t.path))?.value || "queues";

    return (
        <div className="space-y-6">
            <Tabs
                value={activeTab}
                onValueChange={(v) => router.push(`/admin/${v}`)}
            >
                <TabsList className="inline-flex h-10 items-center justify-start gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {TABS.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger
                            key={value}
                            value={value}
                            className="flex items-center gap-2 px-4"
                        >
                            <Icon className="h-4 w-4" />
                            <span className="hidden sm:inline">{label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            {children}
        </div>
    );
}
