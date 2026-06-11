import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { UserPreference } from "@/lib/models/user-preference";
import { themePreferenceSchema } from "@/lib/validations/user-preference";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";

export const PUT = withAuth(async (req, session) => {
  const body = await req.json();
  const parsed = themePreferenceSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  await connectToDatabase();

  const doc = await UserPreference.findOneAndUpdate(
    { userId: session.user.id },
    { $set: { theme: parsed.data.theme } },
    { upsert: true, returnDocument: "after" }
  ).lean();

  return NextResponse.json({ theme: doc!.theme });
});
