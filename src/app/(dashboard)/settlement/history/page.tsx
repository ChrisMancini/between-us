import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Settlement } from "@/lib/models/settlement";
import { formatCurrency, formatMonthYear } from "@/lib/utils";
import { PersonBadge } from "@/components/person-badge";
import { getPersons, buildPersonMap, badgeProps } from "@/lib/persons";
import { SettlementRowCard } from "@/components/settlement-row-card";
import { TruncatedNote } from "./_components/truncated-note";

export const dynamic = "force-dynamic";

export default async function SettlementHistoryPage() {
  const session = await auth();
  if (!session) redirect("/login");

  await connectToDatabase();

  const persons = (await getPersons())!;
  const personMap = buildPersonMap(persons);

  const settlements = await Settlement.find({ status: "closed" })
    .sort({ year: -1, month: -1 })
    .lean();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/settlement"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Settlement
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Settlement History
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All closed monthly settlements.
        </p>
      </div>

      {settlements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No settlements have been closed yet.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-primary/10 bg-primary/5 px-5 py-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
              Closed Settlements
            </p>
            <p className="text-xs text-muted-foreground">
              {settlements.length}{" "}
              {settlements.length === 1 ? "month" : "months"}
            </p>
          </div>

          {/* Desktop table — hidden below sm */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Month
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Owed By
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Owed To
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Amount
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Closed On
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Note
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {settlements.map((s) => (
                <tr
                  key={`${s.year}-${s.month}`}
                  className="hover:bg-muted/60 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium">
                    <Link
                      href={`/settlement?month=${s.month}&year=${s.year}`}
                      className="text-primary hover:underline underline-offset-2"
                    >
                      {formatMonthYear(s.month, s.year)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <PersonBadge {...badgeProps(s.owedBy, personMap)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <PersonBadge {...badgeProps(s.owedTo, personMap)} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {formatCurrency(s.totalOwed)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(s.closedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[200px]">
                    {s.note ? (
                      <TruncatedNote text={s.note} />
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards — shown below sm */}
          <div className="sm:hidden divide-y divide-border">
            {settlements.map((s) => (
              <SettlementRowCard
                key={`${s.year}-${s.month}`}
                label={formatMonthYear(s.month, s.year)}
                href={`/settlement?month=${s.month}&year=${s.year}`}
                amount={s.totalOwed}
                owedBy={s.owedBy}
                owedTo={s.owedTo}
                personMap={personMap}
                meta={new Date(s.closedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              >
                {s.note && (
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    <TruncatedNote text={s.note} />
                  </div>
                )}
              </SettlementRowCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}