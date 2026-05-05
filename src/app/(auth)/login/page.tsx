import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import { getAppSettings } from "@/lib/app-settings";
import { PROVIDER_REGISTRY } from "@/lib/auth-providers";
import { LoginForm } from "./_components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await connectToDatabase();
  const persons = await Person.find().sort({ colorIndex: 1 }).lean();

  if (persons.length < 2) redirect("/setup");

  const settings = await getAppSettings();

  const personOptions = persons.map((p) => ({
    key: p.key as string,
    displayName: p.displayName as string,
    colorIndex: p.colorIndex as 0 | 1,
  }));

  const providerName = settings.oauthProvider
    ? PROVIDER_REGISTRY[settings.oauthProvider]?.name ?? settings.oauthProvider
    : null;

  return (
    <LoginForm
      persons={personOptions}
      authMethod={settings.authMethod}
      oauthProvider={settings.oauthProvider}
      oauthProviderName={providerName}
    />
  );
}
