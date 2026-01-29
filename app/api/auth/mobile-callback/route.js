import { auth } from "../../../../auth";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getCurrentUser } from "../../utils/auth";
import { connectToDatabase } from "../../../../src/db.mjs";

/**
 * Mobile auth callback - redirects to app with session token
 *
 * After Google OAuth completes, the mobile app redirects here.
 * We check if the user is authenticated and redirect back to the app
 * with the session info.
 */
export async function GET(request) {
    const session = await auth();

    if (!session?.user) {
        // Not authenticated - redirect to app with error
        return NextResponse.redirect("enntityvoice://auth?error=not_authenticated");
    }

    // Get full user info from database
    await connectToDatabase();
    const user = await getCurrentUser();

    if (!user?.contextId) {
        return NextResponse.redirect("enntityvoice://auth?error=user_not_found");
    }

    // Create a signed JWT for mobile
    console.log("[mobile-callback] Creating token for user:", user.userId);
    console.log("[mobile-callback] AUTH_SECRET exists:", !!process.env.AUTH_SECRET);
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const token = await new SignJWT({
        userId: user.userId,
        contextId: user.contextId,
        contextKey: user.contextKey,
        email: session.user.email,
        name: user.name || session.user.name,
        image: session.user.image,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);

    console.log("[mobile-callback] Token created, length:", token.length);
    console.log("[mobile-callback] Token preview:", token.substring(0, 50) + "...");

    // Redirect to app with token
    return NextResponse.redirect(`enntityvoice://auth?token=${token}`);
}
