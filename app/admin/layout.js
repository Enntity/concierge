import { redirect } from "next/navigation";
import { getCurrentUser } from "../api/utils/auth";
import AdminTabs from "./components/AdminTabs";

export default async function AdminLayout({ children }) {
    const user = await getCurrentUser();

    if (!user || user.role !== "admin") {
        redirect("/");
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Admin
                </h1>
            </div>
            <AdminTabs>{children}</AdminTabs>
        </div>
    );
}
