import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import type { SerializedPerson } from "@/types/person";
import { PeopleRoles } from "./_components/people-roles";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  await connectToDatabase();

  const rawPeople = await Person.find().sort({ colorIndex: 1 }).lean();

  const persons: SerializedPerson[] = rawPeople.map((p) => ({
    _id: p._id.toString(),
    key: p.key as string,
    displayName: p.displayName as string,
    role: p.role as "admin" | "user",
    colorIndex: p.colorIndex as 0 | 1,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">People</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage user roles.
        </p>
      </div>

      <PeopleRoles persons={persons} />
    </div>
  );
}
