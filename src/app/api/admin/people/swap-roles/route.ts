import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import { withAdmin } from "@/lib/auth-guard";

export const POST = withAdmin(async () => {
  await connectToDatabase();

  const people = await Person.find();
  if (people.length !== 2) {
    return NextResponse.json(
      { error: "Expected exactly 2 people" },
      { status: 422 }
    );
  }

  await Person.bulkWrite([
    {
      updateOne: {
        filter: { _id: people[0]._id },
        update: { role: people[1].role },
      },
    },
    {
      updateOne: {
        filter: { _id: people[1]._id },
        update: { role: people[0].role },
      },
    },
  ]);

  return NextResponse.json({ ok: true });
});
