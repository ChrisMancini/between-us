import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import { getAvailableOAuthProviders } from "@/lib/auth-providers";
import { SetupWizard } from "./_components/setup-wizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await connectToDatabase();
  const count = await Person.countDocuments();

  if (count >= 2) redirect("/login");

  const availableProviders = getAvailableOAuthProviders();

  return <SetupWizard availableProviders={availableProviders} />;
}
