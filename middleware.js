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
    "/api/auth/callback", // NextAuth OAuth callbacks
    "/api/auth/signin", // NextAuth sign-in
    "/api/auth/signout", // NextAuth sign-out
    "/api/auth/session", // NextAuth session check
    "/api/auth/csrf", // NextAuth CSRF token
    "/api/auth/providers", // NextAuth providers list
    "/api/auth/error", // NextAuth error page
    "/api/auth/mobile-callback", // Mobile OAuth callback
    "/api/auth/mobile", // Mobile JWT verification (has own auth)
    "/api/auth/check-user", // Protected by x-auth-secret
    "/api/auth/log-signup-request", // Protected by x-auth-secret
    "/api/mobile/entities", // Mobile entities (has own JWT auth)
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
