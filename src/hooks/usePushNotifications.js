"use client";
import { useCallback, useEffect, useRef } from "react";
import axios from "../../app/utils/axios-client";

const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
};

export default function usePushNotifications({ enabled }) {
    const initializedRef = useRef(false);

    const registerForPush = useCallback(async () => {
        if (initializedRef.current) {
            return;
        }

        if (
            typeof window === "undefined" ||
            !("serviceWorker" in navigator) ||
            !("PushManager" in window)
        ) {
            return;
        }

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
            return;
        }

        initializedRef.current = true;
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const swUrl = `${basePath}/sw.js`;
        const scope = `${basePath}/`;

        try {
            // Register the service worker
            await navigator.serviceWorker.register(swUrl, {
                scope,
            });

            // Wait for the service worker to be ready (activated)
            const registration = await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                if (Notification.permission === "default") {
                    const promptedKey = "pwa_push_prompted";
                    if (!localStorage.getItem(promptedKey)) {
                        localStorage.setItem(promptedKey, "true");
                        await Notification.requestPermission();
                    }
                }

                if (Notification.permission !== "granted") {
                    return;
                }

                const applicationServerKey = urlBase64ToUint8Array(publicKey);
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });
            }

            await axios.post("/api/push-subscription", {
                subscription,
                userAgent: navigator.userAgent,
            });
        } catch (error) {
            console.warn("Push registration failed:", error);
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            registerForPush();
        }
    }, [enabled, registerForPush]);

    return { registerForPush };
}
