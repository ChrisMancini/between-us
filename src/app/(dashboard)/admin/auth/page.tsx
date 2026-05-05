import { connectToDatabase } from "@/lib/db";
import { Person } from "@/lib/models/person";
import { getAppSettings } from "@/lib/app-settings";
import { getAvailableOAuthProviders } from "@/lib/auth-providers";
import { AuthSettingsForm } from "./_components/auth-settings-form";

export const dynamic = "force-dynamic";

export default async function AuthSettingsPage() {
  await connectToDatabase();
  const settings = await getAppSettings();
  const availableProviders = getAvailableOAuthProviders();

  const persons = await Person.find().sort({ colorIndex: 1 }).lean();
  const personData = persons.map((p) => ({
    key: p.key as string,
    displayName: p.displayName as string,
    emails: (p.emails as Record<string, string>) ?? {},
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Authentication</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure how users sign in to the app.
        </p>
      </div>

      <AuthSettingsForm
        currentAuthMethod={settings.authMethod}
        currentProvider={settings.oauthProvider}
        availableProviders={availableProviders}
        persons={personData}
      />
    </div>
  );
}
