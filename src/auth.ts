import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { buildProviders } from "@/lib/auth-providers";
import { authCallbacks } from "@/lib/auth-callbacks";

// fallow-ignore-next-line unused-export
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: buildProviders(),
  callbacks: {
    authorized: authConfig.callbacks!.authorized!,
    ...authCallbacks,
  },
});
