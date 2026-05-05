import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import { Category } from "@/lib/models/category";
import { AppSettings } from "@/lib/models/app-settings";
import { getAvailableOAuthProviders } from "@/lib/auth-providers";

const personSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric, hyphens, or underscores"),
  displayName: z.string().min(1).max(64),
  role: z.enum(["admin", "user"]),
  emails: z.record(z.string(), z.string().email()).optional(),
});

const setupSchema = z
  .object({
    authMethod: z.enum(["basic", "oauth"]),
    oauthProvider: z.string().nullable(),
    persons: z.tuple([personSchema, personSchema]).refine(
      ([a, b]) => a.key !== b.key,
      { message: "Person keys must be unique" }
    ),
  })
  .refine(
    (data) => {
      if (data.authMethod === "oauth") {
        return data.oauthProvider !== null;
      }
      return true;
    },
    { message: "An OAuth provider must be selected" }
  )
  .refine(
    (data) => {
      if (data.authMethod === "oauth" && data.oauthProvider) {
        return data.persons.every((p) => p.emails?.[data.oauthProvider!]);
      }
      return true;
    },
    { message: "Email is required for each person when using OAuth" }
  )
  .refine(
    (data) => {
      if (data.authMethod === "oauth" && data.oauthProvider) {
        const e0 = data.persons[0].emails?.[data.oauthProvider]?.toLowerCase();
        const e1 = data.persons[1].emails?.[data.oauthProvider]?.toLowerCase();
        if (e0 && e1) return e0 !== e1;
      }
      return true;
    },
    { message: "Email addresses must be different" }
  );

const DEFAULT_CATEGORIES = [
  { name: "Mortgage", settlementType: "immediate" as const, sortOrder: 0 },
  { name: "Groceries", settlementType: "deferred" as const, sortOrder: 1 },
  { name: "Bills", settlementType: "deferred" as const, sortOrder: 2 },
  { name: "Miscellaneous", settlementType: "deferred" as const, sortOrder: 3 },
  { name: "Insurance", settlementType: "deferred" as const, sortOrder: 4 },
];

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = setupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const existingCount = await Person.countDocuments();
  if (existingCount >= 2) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 409 }
    );
  }

  const { authMethod, oauthProvider, persons } = parsed.data;

  if (authMethod === "oauth" && oauthProvider) {
    const available = getAvailableOAuthProviders();
    if (!available.some((p) => p.key === oauthProvider)) {
      return NextResponse.json(
        { error: `OAuth provider "${oauthProvider}" is not configured. Set the required environment variables and restart.` },
        { status: 400 }
      );
    }
  }

  const [p1, p2] = persons;

  await Person.create([
    { ...p1, colorIndex: 0 },
    { ...p2, colorIndex: 1 },
  ]);

  await AppSettings.findOneAndUpdate(
    {},
    { authMethod, oauthProvider: authMethod === "oauth" ? oauthProvider : null },
    { upsert: true }
  );

  const existingCategories = await Category.countDocuments();
  if (existingCategories === 0) {
    await Category.insertMany(DEFAULT_CATEGORIES);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
