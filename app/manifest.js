export default function manifest() {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const startUrl = basePath ? `${basePath}/home` : "/home";
    const scope = basePath || "/";
    const appName = "Enntity";
    const icon192 = `${basePath}/app/assets/enntity_logo_192.png`;
    const icon512 = `${basePath}/app/assets/enntity_logo_512.png`;

    return {
        name: appName,
        short_name: appName,
        description: "Enntity Proactive Assistant",
        start_url: startUrl,
        scope,
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        icons: [
            {
                src: icon192,
                sizes: "192x192",
                type: "image/png",
                purpose: "any maskable",
            },
            {
                src: icon512,
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable",
            },
        ],
    };
}
