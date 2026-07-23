"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Receipt, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthMethodStep } from "./auth-method-step";
import { PeopleStep, type PersonInput } from "./people-step";
import { TagsStep } from "./tags-step";
import type { AvailableProvider } from "@/lib/auth-providers";

const STEPS = ["Auth", "People", "Tags"] as const;

interface SetupWizardProps {
  availableProviders: AvailableProvider[];
}

export function SetupWizard({ availableProviders }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [authMethod, setAuthMethod] = useState<"basic" | "oauth">("basic");
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);

  const [persons, setPersons] = useState<[PersonInput, PersonInput]>([
    { displayName: "", key: "", role: "admin", emails: {} },
    { displayName: "", key: "", role: "user", emails: {} },
  ]);

  const [tags, setTags] = useState<string[]>([]);
  const emailTouched = useRef(false);

  function getEmailErrors(
    p: [PersonInput, PersonInput],
    method: string,
    provider: string | null
  ): Record<string, string> {
    const errs: Record<string, string> = {};
    if (method !== "oauth" || !provider) return errs;

    const email0 = (p[0].emails[provider] ?? "").trim().toLowerCase();
    const email1 = (p[1].emails[provider] ?? "").trim().toLowerCase();

    if (!email0) errs.person0Email = "Email is required for OAuth";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email0))
      errs.person0Email = "Invalid email address";

    if (!email1) errs.person1Email = "Email is required for OAuth";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email1))
      errs.person1Email = "Invalid email address";

    if (email0 && email1 && email0 === email1)
      errs.emails = "Email addresses must be different";

    return errs;
  }

  const validateEmails = useCallback(() => {
    emailTouched.current = true;
    setErrors((prev) => {
      const withoutEmail = Object.fromEntries(
        Object.entries(prev).filter(
          ([k]) => !k.includes("Email") && k !== "emails"
        )
      );
      return { ...withoutEmail, ...getEmailErrors(persons, authMethod, oauthProvider) };
    });
  }, [persons, authMethod, oauthProvider]);

  function validatePeople(): boolean {
    const errs: Record<string, string> = {};

    if (!persons[0].displayName.trim()) errs.person0Name = "Name is required";
    if (!persons[1].displayName.trim()) errs.person1Name = "Name is required";

    const key0 = persons[0].key.trim();
    const key1 = persons[1].key.trim();

    if (!key0) errs.person0Key = "Key is required";
    else if (!/^[a-z0-9_-]+$/.test(key0))
      errs.person0Key = "Lowercase letters, numbers, hyphens, underscores only";

    if (!key1) errs.person1Key = "Key is required";
    else if (!/^[a-z0-9_-]+$/.test(key1))
      errs.person1Key = "Lowercase letters, numbers, hyphens, underscores only";

    if (key0 && key1 && key0 === key1) errs.keys = "Keys must be different";

    Object.assign(errs, getEmailErrors(persons, authMethod, oauthProvider));

    emailTouched.current = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (step === 1 && !validatePeople()) return;
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    setSubmitting(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authMethod,
          oauthProvider: authMethod === "oauth" ? oauthProvider : null,
          persons: persons.map((p) => ({
            key: p.key.trim(),
            displayName: p.displayName.trim(),
            role: p.role,
            ...(authMethod === "oauth" && oauthProvider
              ? { emails: { [oauthProvider]: (p.emails[oauthProvider] ?? "").trim().toLowerCase() } }
              : {}),
          })),
          tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Setup failed");
        setSubmitting(false);
        return;
      }

      toast.success("Setup complete!");
      await signOut({ redirect: false });
      router.push("/login");
    } catch {
      toast.error("Something went wrong");
      setSubmitting(false);
    }
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-100 dark:from-background dark:via-background dark:to-background">
      <div className="w-full max-w-lg px-4">
        <div className="bg-card rounded-2xl shadow-xl border border-primary/10 p-8 sm:p-10 flex flex-col gap-8">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Receipt className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome to Between Us
              </h1>
              <p className="text-sm text-muted-foreground">
                Let&apos;s get your shared expense tracker set up.
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                  <span>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-8 h-px bg-border" />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          {step === 0 && (
            <AuthMethodStep
              authMethod={authMethod}
              oauthProvider={oauthProvider}
              availableProviders={availableProviders}
              onAuthMethodChange={setAuthMethod}
              onProviderChange={setOauthProvider}
            />
          )}
          {step === 1 && (
            <PeopleStep
              persons={persons}
              onChange={(updated) => {
                setPersons(updated);
                if (emailTouched.current) {
                  setErrors((prev) => {
                    const withoutEmail = Object.fromEntries(
                      Object.entries(prev).filter(
                        ([k]) => !k.includes("Email") && k !== "emails"
                      )
                    );
                    return { ...withoutEmail, ...getEmailErrors(updated, authMethod, oauthProvider) };
                  });
                }
              }}
              onValidate={validateEmails}
              errors={errors}
              authMethod={authMethod}
              oauthProvider={oauthProvider}
              availableProviders={availableProviders}
            />
          )}
          {step === 2 && <TagsStep tags={tags} onTagsChange={setTags} />}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setErrors({});
                setStep((s) => s - 1);
              }}
              disabled={step === 0}
              className="gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                aria-busy={submitting}
                className="gap-1.5"
              >
                {submitting ? "Setting up..." : "Complete Setup"}
                <Check className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleNext} className="gap-1.5">
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
