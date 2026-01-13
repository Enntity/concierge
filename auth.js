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
            if (!user.email) {
                return false;
            }

            // Check if user exists in database and is not blocked
            // (can't use mongoose directly in Edge Runtime)
            try {
                const baseUrl =
                    process.env.NEXTAUTH_URL ||
                    process.env.AUTH_URL ||
                    "http://localhost:3000";
                
                const checkResponse = await fetch(`${baseUrl}/api/auth/check-user`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-auth-secret": process.env.AUTH_SECRET,
                    },
                    body: JSON.stringify({
                        email: user.email,
                    }),
                });

                if (!checkResponse.ok) {
                    console.error("Failed to check user:", await checkResponse.text());
                    return false;
                }

                const { exists, blocked } = await checkResponse.json();

                // If user is blocked, deny sign-in
                if (blocked) {
                    return false;
                }

                // If user doesn't exist, log signup request for admin review
                if (!exists) {
                    const userDomain = user.email.split("@")[1]?.toLowerCase();
                    try {
                        await fetch(`${baseUrl}/api/auth/log-signup-request`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-auth-secret": process.env.AUTH_SECRET,
                            },
                            body: JSON.stringify({
                                email: user.email,
                                name: user.name,
                                domain: userDomain,
                            }),
                        });
                    } catch (error) {
                        // Don't fail auth if logging fails
                        console.error("Failed to log signup request:", error);
                    }
                    return false;
                }

                // User exists and is not blocked - allow sign-in
                return true;
            } catch (error) {
                console.error("Error checking user during sign-in:", error);
                return false;
            }
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },
    trustHost: true,
});
