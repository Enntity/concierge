"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const SignOutButton = ({ className = "" }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleSignOut = async () => {
        setIsLoading(true);
        try {
            // Sign out and redirect - NextAuth handles cookie clearing server-side
            await signOut({
                callbackUrl: "/auth/login",
                redirect: true,
            });
        } catch (error) {
            console.error("Sign out error:", error);
            // Force redirect on error - server session is likely already invalid
            window.location.href = "/auth/login";
        }
    };

    return (
        <Button
            onClick={handleSignOut}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className={className}
        >
            <LogOut className="h-4 w-4 mr-2" />
            {isLoading ? "Signing out..." : "Sign out"}
        </Button>
    );
};
