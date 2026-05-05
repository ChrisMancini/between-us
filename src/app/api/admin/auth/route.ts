import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { AppSettings } from "@/lib/models/app-settings";
import { Person } from "@/lib/models/person";
import { getAvailableOAuthProviders } from "@/lib/auth-providers";
import { withAdmin } from "@/lib/auth-guard";

const updateSchema = z
  .object({
    authMethod: z.enum(["basic", "oauth"]),
    oauthProvider: z.string().nullable(),
    persons: z
      .array(
        z.object({
          personKey: z.string(),
          emails: z.record(z.string(), z.string().email()),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.authMethod === "oauth") return data.oauthProvider !== null;
      return true;
    },
    { message: "An OAuth provider must be selected" }
  );

export const PUT = withAdmin(async (req) => {
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { authMethod, oauthProvider, persons } = parsed.data;

  if (authMethod === "oauth" && oauthProvider) {
    const available = getAvailableOAuthProviders();
    if (!available.some((p) => p.key === oauthProvider)) {
      return NextResponse.json(
        { error: `Provider "${oauthProvider}" is not configured. Set the required environment variables and restart.` },
        { status: 400 }
      );
    }
  }

  await connectToDatabase();

  if (authMethod === "oauth" && oauthProvider && persons) {
    const activeEmails = persons
      .map((p) => p.emails[oauthProvider]?.toLowerCase())
      .filter(Boolean);
    if (new Set(activeEmails).size !== activeEmails.length) {
      return NextResponse.json(
        { error: "Email addresses must be unique for the selected provider" },
        { status: 400 }
      );
    }

    for (const { personKey, emails } of persons) {
      const existing = await Person.findOne({ key: personKey }).lean();
      const merged = { ...(existing?.emails as Record<string, string> ?? {}), ...emails };
      await Person.findOneAndUpdate({ key: personKey }, { emails: merged });
    }
  }

  await AppSettings.findOneAndUpdate(
    {},
    { authMethod, oauthProvider: authMethod === "oauth" ? oauthProvider : null },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
});
