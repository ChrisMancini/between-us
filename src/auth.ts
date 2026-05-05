import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import { AppSettings } from "@/lib/models/app-settings";
import {
  PROVIDER_REGISTRY,
  getAvailableOAuthProviders,
} from "@/lib/auth-providers";

import type { Provider } from "next-auth/providers";

const providers: Provider[] = [
  Credentials({
    credentials: {
      person: { type: "text" },
    },
    async authorize(credentials) {
      const person = credentials?.person as string;
      if (!person) return null;

      await connectToDatabase();

      const personRecord = await Person.findOne({ key: person });
      if (!personRecord) return null;

      return {
        id: personRecord._id.toString(),
        name: personRecord.displayName,
      };
    },
  }),
];

for (const p of getAvailableOAuthProviders()) {
  const entry = PROVIDER_REGISTRY[p.key];
  const [idVar, secretVar] = entry.envKeys;
  providers.push(entry.createProvider(process.env[idVar]!, process.env[secretVar]!));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers,
  callbacks: {
    authorized: authConfig.callbacks!.authorized!,

    async signIn({ user, account, profile }) {
      await connectToDatabase();
      const settings = await AppSettings.findOne().lean();
      const authMethod = settings?.authMethod ?? "basic";

      if (account?.provider === "credentials" && authMethod === "oauth") {
        return false;
      }
      if (account?.provider !== "credentials" && authMethod === "basic") {
        return false;
      }

      if (account?.provider !== "credentials") {
        const email = (profile?.email ?? user.email)?.toLowerCase();
        if (!email) return false;

        const person = await Person.findOne({ [`emails.${account!.provider}`]: email });
        if (!person) return false;

        user.id = person._id.toString();
        user.name = person.displayName;
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      else if (!token.id && token.sub) token.id = token.sub;

      if ((!token.role || !token.paidByKey) && token.id) {
        try {
          await connectToDatabase();
          const person = (await Person.findById(token.id).lean()) as {
            role?: string;
            key?: string;
          } | null;

          token.role = (person?.role ?? "user") as "admin" | "user";
          token.paidByKey = person?.key ?? "";
        } catch (err) {
          console.error("[jwt] person lookup failed:", err);
        }
      }

      return token;
    },

    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role ?? "user") as "admin" | "user";
      session.user.paidByKey = (token.paidByKey ?? "") as string;
      return session;
    },
  },
});
