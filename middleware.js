import { auth } from "./auth";

export const config = {
    matcher: [
        // Match all paths except static files and Next.js internals
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    ],
};

// Paths that don't require authentication
const PUBLIC_PATHS = [
    "/auth/login",
    "/auth/error",
    "/api/auth",
    "/api/mobile", // Mobile app uses JWT auth, not NextAuth session
    "/api/enntity/push",
    "/privacy",
    "/published",
    "/vad", // VAD model and ONNX runtime files
];

const isPublicPath = (pathname) => {
    return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
};

export default auth((request) => {
    const { pathname } = request.nextUrl;
    const host = request.headers.get("host");

    // Redirect non-canonical domains to ai.enntity.com
    if (host && /^(www\.)?enntity\.com$/i.test(host)) {
        const url = new URL(request.url);
        url.host = "ai.enntity.com";
        return Response.redirect(url.toString(), 301);
    }

    // Allow public paths
    if (isPublicPath(pathname)) {
        return;
    }

    // Check if authenticated
    if (request.auth?.user) {
        return;
    }

    // Not authenticated - redirect to login or return 401 for API routes
    if (pathname.startsWith("/api/")) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Redirect to login with callback
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
});
