/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
    let data = {};

    if (event.data) {
        try {
            data = event.data.json();
        } catch (error) {
            data = { body: event.data.text() };
        }
    }

    const scopeUrl = new URL(self.registration.scope);
    const assetUrl = new URL(
        "app/assets/enntity_logo_192.png",
        scopeUrl,
    ).toString();
    const title = data.title || "Enntity";
    const options = {
        body: data.body || "",
        icon: assetUrl,
        badge: assetUrl,
        tag: data.tag || "enntity-notification",
        renotify: !!data.tag,
        data: {
            url: data.url || "chat",
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const rawUrl = event.notification?.data?.url || "chat";
    const targetUrl = rawUrl.startsWith("http")
        ? rawUrl
        : new URL(
              rawUrl.replace(/^\//, ""),
              self.registration.scope,
          ).toString();

    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if ("focus" in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }

                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            }),
    );
});
