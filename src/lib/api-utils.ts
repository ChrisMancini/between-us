import { NextResponse } from "next/server";

export function validationError(parsed: { error: { issues: unknown[] } }) {
  return NextResponse.json(
    { error: "Validation failed", details: parsed.error.issues },
    { status: 400 },
  );
}
