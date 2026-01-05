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
            await signOut({ callbackUrl: "/auth/login" });
        } catch (error) {
            console.error("Sign out error:", error);
            window.location.href = "/auth/login";
        } finally {
            setIsLoading(false);
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
