import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Validate required environment variables
if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET environment variable is required");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
    ],
    pages: {
        signIn: "/auth/login",
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
                const domains = allowedDomains.split(",").map((d) => d.trim().toLowerCase());
                const userDomain = user.email.split("@")[1]?.toLowerCase();
                if (!domains.includes(userDomain)) {
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
