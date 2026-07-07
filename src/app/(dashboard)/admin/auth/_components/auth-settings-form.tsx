"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProviderIcon } from "@/components/provider-icon";
import type { AvailableProvider } from "@/lib/auth-providers";

interface PersonData {
  key: string;
  displayName: string;
  emails: Record<string, string>;
}

interface AuthSettingsFormProps {
  currentAuthMethod: "basic" | "oauth";
  currentProvider: string | null;
  availableProviders: AvailableProvider[];
  persons: PersonData[];
}

function validateOAuthSettings(
  authMethod: string,
  oauthProvider: string | null,
  persons: PersonData[],
  providerName: string | null,
): string | null {
  if (authMethod !== "oauth") return null;

  if (!oauthProvider) return "Please select an OAuth provider.";

  for (const p of persons) {
    if (!(p.emails[oauthProvider] ?? "").trim()) {
      return `${providerName} email is required for ${p.displayName}.`;
    }
  }

  if (
    persons.length === 2 &&
    (persons[0].emails[oauthProvider] ?? "").toLowerCase() ===
      (persons[1].emails[oauthProvider] ?? "").toLowerCase()
  ) {
    return "Email addresses must be different.";
  }

  return null;
}

function buildAuthPayload(
  authMethod: string,
  oauthProvider: string | null,
  persons: PersonData[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    authMethod,
    oauthProvider: authMethod === "oauth" ? oauthProvider : null,
  };

  if (authMethod === "oauth") {
    payload.persons = persons.map((p) => ({
      personKey: p.key,
      emails: Object.fromEntries(
        Object.entries(p.emails)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => [k, v.trim().toLowerCase()])
      ),
    }));
  }

  return payload;
}

export function AuthSettingsForm({
  currentAuthMethod,
  currentProvider,
  availableProviders,
  persons: initialPersons,
}: AuthSettingsFormProps) {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState(currentAuthMethod);
  const [oauthProvider, setOauthProvider] = useState<string | null>(
    currentProvider
  );
  const [persons, setPersons] = useState(initialPersons);
  const [saving, setSaving] = useState(false);

  const hasProviders = availableProviders.length > 0;
  const hasChanges =
    authMethod !== currentAuthMethod ||
    oauthProvider !== currentProvider ||
    persons.some(
      (p, i) =>
        JSON.stringify(p.emails) !== JSON.stringify(initialPersons[i].emails)
    );

  const providerName = availableProviders.find((p) => p.key === oauthProvider)?.name ?? oauthProvider;

  function updateEmail(index: number, provider: string, email: string) {
    setPersons((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, emails: { ...p.emails, [provider]: email } } : p
      )
    );
  }

  async function handleSave() {
    const error = validateOAuthSettings(authMethod, oauthProvider, persons, providerName);
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAuthPayload(authMethod, oauthProvider, persons)),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }

      toast.success("Authentication settings saved.");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Auth method selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setAuthMethod("basic")}
          className={cn(
            "flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all cursor-pointer",
            authMethod === "basic"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/60"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Person Selector</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Simple click-to-sign-in. No passwords or external accounts.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!hasProviders) return;
            setAuthMethod("oauth");
            if (!oauthProvider && availableProviders.length > 0) {
              setOauthProvider(availableProviders[0].key);
            }
          }}
          disabled={!hasProviders}
          className={cn(
            "flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all cursor-pointer",
            !hasProviders && "opacity-50 !cursor-not-allowed",
            authMethod === "oauth"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-muted-foreground/30 hover:bg-muted/60"
          )}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">OAuth Provider</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {hasProviders
              ? "Sign in with an external account."
              : "No OAuth providers configured. Set provider environment variables and restart."}
          </p>
        </button>
      </div>

      {/* Provider selection */}
      {authMethod === "oauth" && hasProviders && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Provider</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableProviders.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setOauthProvider(p.key)}
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer",
                  oauthProvider === p.key
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                )}
              >
                <ProviderIcon providerKey={p.key} className="w-4 h-4" />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Email mapping */}
      {authMethod === "oauth" && oauthProvider && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">
              {providerName} Email Mapping
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each person&apos;s email must match their {providerName} account.
            </p>
          </div>
          {persons.map((p, i) => (
            <div key={p.key} className="space-y-1.5">
              <Label htmlFor={`email-${p.key}-${oauthProvider}`}>
                {p.displayName}
              </Label>
              <Input
                id={`email-${p.key}-${oauthProvider}`}
                type="email"
                placeholder={`${p.displayName.toLowerCase()}@example.com`}
                value={p.emails[oauthProvider] ?? ""}
                onChange={(e) => updateEmail(i, oauthProvider, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
