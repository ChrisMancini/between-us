"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERSON_COLORS } from "@/lib/person-utils";
import { ProviderIcon } from "@/components/provider-icon";

interface PersonOption {
  key: string;
  displayName: string;
  colorIndex: 0 | 1;
}

interface LoginFormProps {
  persons: PersonOption[];
  authMethod: "basic" | "oauth";
  oauthProvider: string | null;
  oauthProviderName: string | null;
}

export function LoginForm({ persons, authMethod, oauthProvider, oauthProviderName }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const error = searchParams.get("error");

  async function handleCredentialsLogin() {
    if (!selected) return;
    setLoading(true);

    const result = await signIn("credentials", {
      person: selected,
      redirect: false,
    });

    if (result?.ok) {
      router.push("/dashboard");
    }

    setLoading(false);
  }

  function handleOAuthLogin() {
    if (!oauthProvider) return;
    setLoading(true);
    signIn(oauthProvider, { callbackUrl: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 dark:from-background dark:via-background dark:to-background">
      <div className="w-full max-w-sm px-4">
        <div className="bg-card rounded-2xl shadow-xl border border-primary/10 p-10 flex flex-col items-center gap-8">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Receipt className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Between Us</h1>
              <p className="text-sm text-muted-foreground">
                Shared expenses, settled monthly.
              </p>
            </div>
          </div>

          {/* Error message */}
          {error === "AccessDenied" && (
            <div className="w-full rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
              <p className="text-sm text-destructive">
                Your account is not associated with any person in this app.
                Contact the admin to add your email.
              </p>
            </div>
          )}

          {authMethod === "basic" ? (
            <>
              {/* Person selector */}
              <div className="w-full space-y-3">
                <p className="text-sm font-medium text-center text-muted-foreground">
                  Who are you?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {persons.map((p) => {
                    const colors = PERSON_COLORS[p.colorIndex];
                    const isSelected = selected === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelected(p.key)}
                        className={cn(
                          "focus-ring flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all cursor-pointer",
                          isSelected
                            ? `${colors.border} ${colors.selectedBg} shadow-sm`
                            : "border-border hover:border-muted-foreground/30 hover:bg-muted/60"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            colors.bg,
                            colors.text
                          )}
                        >
                          {p.displayName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Continue */}
              <Button
                onClick={handleCredentialsLogin}
                disabled={!selected || loading}
                aria-busy={loading}
                className="w-full h-11 font-medium"
              >
                {loading ? "Signing in..." : "Continue"}
              </Button>
            </>
          ) : (
            <>
              {/* OAuth login */}
              <div className="w-full space-y-3">
                <p className="text-sm font-medium text-center text-muted-foreground">
                  Sign in to continue
                </p>
                <Button
                  onClick={handleOAuthLogin}
                  disabled={loading || !oauthProvider}
                  aria-busy={loading}
                  className="w-full h-11 font-medium gap-2"
                >
                  {oauthProvider && <ProviderIcon providerKey={oauthProvider} className="w-4 h-4" />}
                  {loading
                    ? "Redirecting..."
                    : `Sign in with ${oauthProviderName ?? "OAuth"}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
