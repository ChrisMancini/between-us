import "server-only";
import { connectToDatabase } from "@/lib/db";
import { AppSettings } from "@/lib/models/app-settings";

export interface AppSettingsData {
  authMethod: "basic" | "oauth";
  oauthProvider: string | null;
}

const DEFAULT_SETTINGS: AppSettingsData = {
  authMethod: "basic",
  oauthProvider: null,
};

export async function getAppSettings(): Promise<AppSettingsData> {
  await connectToDatabase();
  const doc = await AppSettings.findOne().lean();
  if (!doc) {
    await AppSettings.create(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return {
    authMethod: doc.authMethod,
    oauthProvider: doc.oauthProvider ?? null,
  };
}
