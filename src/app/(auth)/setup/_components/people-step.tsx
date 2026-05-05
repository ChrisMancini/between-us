"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERSON_COLORS } from "@/lib/person-utils";
import type { AvailableProvider } from "@/lib/auth-providers";

export interface PersonInput {
  displayName: string;
  key: string;
  role: "admin" | "user";
  emails: Record<string, string>;
}

interface PeopleStepProps {
  persons: [PersonInput, PersonInput];
  onChange: (persons: [PersonInput, PersonInput]) => void;
  onValidate?: () => void;
  errors: Record<string, string>;
  authMethod: "basic" | "oauth";
  oauthProvider: string | null;
  availableProviders: AvailableProvider[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function PeopleStep({ persons, onChange, onValidate, errors, authMethod, oauthProvider, availableProviders }: PeopleStepProps) {
  const providerName = availableProviders.find((p) => p.key === oauthProvider)?.name ?? oauthProvider;

  function updatePerson(index: 0 | 1, field: keyof PersonInput, value: string) {
    const updated = [...persons] as [PersonInput, PersonInput];

    if (field === "emails" && oauthProvider) {
      updated[index] = {
        ...updated[index],
        emails: { ...updated[index].emails, [oauthProvider]: value },
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    if (field === "displayName") {
      updated[index].key = slugify(value);
    }

    onChange(updated);
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold">Who&apos;s splitting expenses?</h2>
        <p className="text-sm text-muted-foreground">
          Enter the two people who will share expenses.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {([0, 1] as const).map((i) => {
          const colors = PERSON_COLORS[i];

          return (
            <div
              key={i}
              className={`rounded-xl border-2 p-5 space-y-4 ${colors.border} ${colors.selectedBg}`}
            >
              <span className="text-sm font-medium text-muted-foreground">
                Person {i + 1}
              </span>

              <div className="space-y-2">
                <Label htmlFor={`name-${i}`}>Display Name</Label>
                <Input
                  id={`name-${i}`}
                  placeholder={i === 0 ? "e.g. Alex" : "e.g. Jordan"}
                  value={persons[i].displayName}
                  onChange={(e) => updatePerson(i, "displayName", e.target.value)}
                  autoFocus={i === 0}
                />
                {errors[`person${i}Name`] && (
                  <p className="text-xs text-destructive">{errors[`person${i}Name`]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`key-${i}`}>
                  Key
                  <span className="text-muted-foreground font-normal ml-1">
                    (used internally)
                  </span>
                </Label>
                <Input
                  id={`key-${i}`}
                  placeholder="auto-generated"
                  value={persons[i].key}
                  onChange={(e) => updatePerson(i, "key", e.target.value)}
                  className="font-mono text-sm"
                />
                {errors[`person${i}Key`] && (
                  <p className="text-xs text-destructive">{errors[`person${i}Key`]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`role-${i}`}>Role</Label>
                <Select
                  value={persons[i].role}
                  onValueChange={(v) => v && updatePerson(i, "role", v)}
                >
                  <SelectTrigger id={`role-${i}`}>
                    <SelectValue>{persons[i].role === "admin" ? "Admin" : "User"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {persons[i].role === "admin"
                    ? "Can manage categories and app settings."
                    : "Can add and view expenses."}
                </p>
              </div>

              {authMethod === "oauth" && oauthProvider && (
                <div className="space-y-2">
                  <Label htmlFor={`email-${i}`}>
                    {providerName} Email
                  </Label>
                  <Input
                    id={`email-${i}`}
                    type="email"
                    required
                    placeholder={i === 0 ? "alex@gmail.com" : "jordan@gmail.com"}
                    value={persons[i].emails[oauthProvider] ?? ""}
                    onChange={(e) => updatePerson(i, "emails", e.target.value)}
                    onBlur={onValidate}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must match their {providerName} account email.
                  </p>
                  {errors[`person${i}Email`] && (
                    <p className="text-xs text-destructive">{errors[`person${i}Email`]}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(errors.keys || errors.emails) && (
        <p className="text-xs text-destructive text-center">{errors.keys ?? errors.emails}</p>
      )}
    </div>
  );
}
