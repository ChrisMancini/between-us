import { NextResponse } from "next/server";
import mongoose from "mongoose";

export function validationError(parsed: { error: { issues: unknown[] } }) {
  return NextResponse.json(
    { error: "Validation failed", details: parsed.error.issues },
    { status: 400 },
  );
}

export function invalidId(id: string): NextResponse | null {
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  return null;
}

export function duplicateKeyResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}
