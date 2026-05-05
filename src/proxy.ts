import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Default export is the auth function — Next.js 16 proxy convention.
export default auth;

export const config = {
  // Protect all routes except the auth API, static assets, and favicon
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
