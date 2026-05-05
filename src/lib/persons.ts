import "server-only";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import type { SerializedPerson, PersonPair } from "@/types/person";

export type { SerializedPerson, PersonPair } from "@/types/person";
export { PERSON_COLORS, buildPersonMap, badgeProps } from "@/lib/person-utils";

function serialize(doc: InstanceType<typeof Person>): SerializedPerson {
  return {
    _id: doc._id.toString(),
    key: doc.key,
    displayName: doc.displayName,
    role: doc.role,
    colorIndex: doc.colorIndex as 0 | 1,
    ...(doc.emails ? { emails: doc.emails } : {}),
  };
}

export async function getPersons(): Promise<PersonPair | null> {
  await connectToDatabase();
  const docs = await Person.find().sort({ colorIndex: 1 }).lean();
  if (docs.length < 2) return null;
  return [serialize(docs[0]), serialize(docs[1])] as PersonPair;
}
