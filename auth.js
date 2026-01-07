import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Note: AUTH_SECRET is required at runtime. NextAuth will throw if missing.

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
    ],
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
    callbacks: {
        // Prevent open redirect attacks
        async redirect({ url, baseUrl }) {
            // Only allow redirects to same origin
            if (url.startsWith("/")) {
                return `${baseUrl}${url}`;
            }
            if (url.startsWith(baseUrl)) {
                return url;
            }
            return baseUrl;
        },
        async jwt({ token, user, account }) {
            if (account && user) {
                token.userId = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.userId || token.sub;
            }
            return session;
        },
        async signIn({ user }) {
            // Restrict to specific email domains if configured
            const allowedDomains = process.env.AUTH_ALLOWED_DOMAINS;
            if (allowedDomains && user.email) {
                const domains = allowedDomains
                    .split(",")
                    .map((d) => d.trim().toLowerCase());
                const userDomain = user.email.split("@")[1]?.toLowerCase();
                if (!domains.includes(userDomain)) {
                    // Log the signup request for admin review (upsert to prevent spam)
                    try {
                        const { default: UserSignupRequest } = await import(
                            "./app/api/models/user-signup-request.mjs"
                        );
                        const { connectToDatabase } = await import(
                            "./src/db.mjs"
                        );
                        await connectToDatabase();

                        // Use upsert to update existing request or create new one
                        // This prevents duplicate entries and rate-limits database writes
                        await UserSignupRequest.findOneAndUpdate(
                            { email: user.email },
                            {
                                $set: {
                                    name: user.name || null,
                                    domain: userDomain,
                                    requestedAt: new Date(),
                                },
                            },
                            { upsert: true, new: true },
                        );
                    } catch (error) {
                        // Don't fail auth if logging fails
                        console.error("Failed to log signup request:", error);
                    }
                    return false;
                }
            }
            return true;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },
    trustHost: true,
});
