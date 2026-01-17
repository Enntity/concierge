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
    const autoInitializedRef = useRef(false);

    /**
     * Register for push notifications
     * @param {Object} options
     * @param {boolean} options.userGesture - True if called from a user gesture (button tap).
     *   When true, always prompts for permission (required for iOS).
     *   When false, only prompts once automatically.
     */
    const registerForPush = useCallback(
        async ({ userGesture = false } = {}) => {
            console.log("[Push] registerForPush called, userGesture:", userGesture);
            
            // For auto-init, only run once
            if (!userGesture && autoInitializedRef.current) {
                console.log("[Push] Already auto-initialized, skipping");
                return;
            }

            if (typeof window === "undefined") {
                console.log("[Push] No window object");
                return;
            }
            
            if (!("serviceWorker" in navigator)) {
                console.log("[Push] serviceWorker not supported");
                return;
            }
            
            if (!("PushManager" in window)) {
                console.log("[Push] PushManager not supported");
                return;
            }

            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            console.log("[Push] VAPID public key present:", !!publicKey);
            if (!publicKey) {
                console.log("[Push] No VAPID public key configured");
                return;
            }

            if (!userGesture) {
                autoInitializedRef.current = true;
            }

            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
            const swUrl = `${basePath}/sw.js`;
            const scope = `${basePath}/`;

            try {
                // Register the service worker
                console.log("[Push] Registering service worker at:", swUrl);
                await navigator.serviceWorker.register(swUrl, {
                    scope,
                });

                // Wait for the service worker to be ready (activated)
                console.log("[Push] Waiting for service worker ready...");
                const registration = await navigator.serviceWorker.ready;
                console.log("[Push] Service worker ready");

                let subscription =
                    await registration.pushManager.getSubscription();
                console.log("[Push] Existing subscription:", !!subscription);
                
                if (!subscription) {
                    // Request permission
                    // For user gesture: always prompt (required for iOS)
                    // For auto: only prompt once (check localStorage)
                    console.log("[Push] Current permission:", Notification.permission);
                    if (Notification.permission === "default") {
                        if (userGesture) {
                            console.log("[Push] Requesting permission (user gesture)...");
                            const result = await Notification.requestPermission();
                            console.log("[Push] Permission result:", result);
                        } else {
                            const promptedKey = "pwa_push_prompted";
                            if (!localStorage.getItem(promptedKey)) {
                                localStorage.setItem(promptedKey, "true");
                                console.log("[Push] Requesting permission (auto)...");
                                await Notification.requestPermission();
                            }
                        }
                    }

                    if (Notification.permission !== "granted") {
                        console.log("[Push] Permission not granted, aborting");
                        return;
                    }

                    console.log("[Push] Subscribing to push manager...");
                    const applicationServerKey =
                        urlBase64ToUint8Array(publicKey);
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey,
                    });
                    console.log("[Push] Subscribed successfully");
                }

                console.log("[Push] Saving subscription to server...");
                await axios.post("/api/push-subscription", {
                    subscription,
                    userAgent: navigator.userAgent,
                });
                console.log("[Push] Registration complete!");
            } catch (error) {
                console.warn("[Push] Registration failed:", error);
                throw error; // Re-throw so caller knows it failed
            }
        },
        [],
    );

    useEffect(() => {
        if (enabled) {
            registerForPush({ userGesture: false });
        }
    }, [enabled, registerForPush]);

    return { registerForPush };
}
