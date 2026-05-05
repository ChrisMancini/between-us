import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import Discord from "next-auth/providers/discord";
import Facebook from "next-auth/providers/facebook";
import LinkedIn from "next-auth/providers/linkedin";
import GitLab from "next-auth/providers/gitlab";
import Slack from "next-auth/providers/slack";
import Twitter from "next-auth/providers/twitter";
import type { Provider } from "next-auth/providers";

interface ProviderRegistryEntry {
  name: string;
  envKeys: [string, string];
  createProvider: (clientId: string, clientSecret: string) => Provider;
}

export const PROVIDER_REGISTRY: Record<string, ProviderRegistryEntry> = {
  google: {
    name: "Google",
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    createProvider: (clientId, clientSecret) => Google({ clientId, clientSecret }),
  },
  github: {
    name: "GitHub",
    envKeys: ["GITHUB_ID", "GITHUB_SECRET"],
    createProvider: (clientId, clientSecret) => GitHub({ clientId, clientSecret }),
  },
  "microsoft-entra-id": {
    name: "Microsoft",
    envKeys: ["MICROSOFT_ENTRA_ID_ID", "MICROSOFT_ENTRA_ID_SECRET"],
    createProvider: (clientId, clientSecret) => MicrosoftEntraId({ clientId, clientSecret }),
  },
  apple: {
    name: "Apple",
    envKeys: ["APPLE_ID", "APPLE_SECRET"],
    createProvider: (clientId, clientSecret) => Apple({ clientId, clientSecret }),
  },
  discord: {
    name: "Discord",
    envKeys: ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET"],
    createProvider: (clientId, clientSecret) => Discord({ clientId, clientSecret }),
  },
  facebook: {
    name: "Facebook",
    envKeys: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
    createProvider: (clientId, clientSecret) => Facebook({ clientId, clientSecret }),
  },
  linkedin: {
    name: "LinkedIn",
    envKeys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    createProvider: (clientId, clientSecret) => LinkedIn({ clientId, clientSecret }),
  },
  gitlab: {
    name: "GitLab",
    envKeys: ["GITLAB_CLIENT_ID", "GITLAB_CLIENT_SECRET"],
    createProvider: (clientId, clientSecret) => GitLab({ clientId, clientSecret }),
  },
  slack: {
    name: "Slack",
    envKeys: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    createProvider: (clientId, clientSecret) => Slack({ clientId, clientSecret }),
  },
  twitter: {
    name: "Twitter",
    envKeys: ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"],
    createProvider: (clientId, clientSecret) => Twitter({ clientId, clientSecret }),
  },
};

export interface AvailableProvider {
  key: string;
  name: string;
}

export function getAvailableOAuthProviders(): AvailableProvider[] {
  return Object.entries(PROVIDER_REGISTRY)
    .filter(([, entry]) => {
      const [idVar, secretVar] = entry.envKeys;
      return process.env[idVar] && process.env[secretVar];
    })
    .map(([key, entry]) => ({ key, name: entry.name }));
}
