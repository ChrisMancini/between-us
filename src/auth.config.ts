import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config — no Node.js-only imports.
// Providers and jwt/session callbacks live in auth.ts where DB access is safe.
export const authConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth;
      const isLoginPage = nextUrl.pathname === "/login";
      const isSetupPage = nextUrl.pathname === "/setup" ||
        nextUrl.pathname.startsWith("/api/setup");

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (isSetupPage) return true;

      if (!isLoggedIn) return false;
      return true;
    },
  },
} satisfies NextAuthConfig;
