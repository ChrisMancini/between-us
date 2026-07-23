"use client";

import { cn } from "@/lib/utils";
import { Users, Shield } from "lucide-react";
import { ProviderIcon } from "@/components/provider-icon";
import type { AvailableProvider } from "@/lib/auth-providers";

interface AuthMethodStepProps {
  authMethod: "basic" | "oauth";
  oauthProvider: string | null;
  availableProviders: AvailableProvider[];
  onAuthMethodChange: (method: "basic" | "oauth") => void;
  onProviderChange: (provider: string) => void;
}

export function AuthMethodStep({
  authMethod,
  oauthProvider,
  availableProviders,
  onAuthMethodChange,
  onProviderChange,
}: AuthMethodStepProps) {
  const hasProviders = availableProviders.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold">How will you sign in?</h2>
        <p className="text-sm text-muted-foreground">
          Choose how you and your partner will log in to the app.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Basic auth */}
        <button
          type="button"
          onClick={() => onAuthMethodChange("basic")}
          className={cn(
            "focus-ring flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all cursor-pointer",
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
            Simple click-to-sign-in. No passwords, no external accounts. Best
            for home networks.
          </p>
        </button>

        {/* OAuth */}
        <button
          type="button"
          onClick={() => {
            if (!hasProviders) return;
            onAuthMethodChange("oauth");
            if (!oauthProvider && availableProviders.length > 0) {
              onProviderChange(availableProviders[0].key);
            }
          }}
          disabled={!hasProviders}
          className={cn(
            "focus-ring flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all cursor-pointer",
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
              ? "Sign in with an external account. Each person needs an email address linked to their account."
              : "No OAuth providers configured. Set provider environment variables (e.g. GOOGLE_CLIENT_ID) and restart the app."}
          </p>
        </button>
      </div>

      {/* Provider selection */}
      {authMethod === "oauth" && hasProviders && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-center text-muted-foreground">
            Select a provider
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableProviders.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onProviderChange(p.key)}
                className={cn(
                  "focus-ring flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer",
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
    </div>
  );
}
