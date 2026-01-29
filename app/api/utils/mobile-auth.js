import { jwtVerify } from "jose";

/**
 * Verify mobile JWT token from request Authorization header.
 * Returns the decoded payload or null if invalid.
 */
export async function verifyMobileToken(request) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.substring(7);
    if (!token) {
        return null;
    }

    try {
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch (error) {
        console.error(
            "[mobile-auth] Token verification failed:",
            error.message,
        );
        return null;
    }
}
