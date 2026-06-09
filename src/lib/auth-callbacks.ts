import type { NextAuthConfig } from "next-auth";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import { AppSettings } from "@/lib/models/app-settings";

type AuthCallbacks = NonNullable<NextAuthConfig["callbacks"]>;

export const authCallbacks = {
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

    if (token.id) {
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
} satisfies AuthCallbacks;
