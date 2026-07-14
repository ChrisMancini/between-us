import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { getPersons } from "@/lib/persons";
import { formatMonthYear, getMonthDateRange } from "@/lib/utils";
import { tagPersonSettlementPipeline } from "../_lib/report-queries";
import {
  buildSectionedComparison,
  splitBySettlementType,
  type SettlementAggRow,
} from "./_lib/compare-transforms";
import { addMonths, clampToPast, currentYM, parseYM, ymToParam } from "./_lib/month-range";
import { ComparisonHeadline } from "./_components/comparison-headline";
import { ComparisonSection } from "./_components/comparison-section";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;

  // Default: comparison (`to`) = current month, baseline (`from`) = prior month.
  // Future months can't have data, so clamp anything past the current month.
  const to = clampToPast(parseYM(params.to) ?? currentYM());
  const from = clampToPast(parseYM(params.from) ?? addMonths(to, -1));

  // Reflect the selection in the URL so it can be bookmarked/shared and survives
  // a reload. Redirect whenever the incoming params aren't already canonical.
  const canonicalFrom = ymToParam(from);
  const canonicalTo = ymToParam(to);
  if (params.from !== canonicalFrom || params.to !== canonicalTo) {
    redirect(`/reports/compare?from=${canonicalFrom}&to=${canonicalTo}`);
  }

  await connectToDatabase();

  const persons = (await getPersons())!;

  const fromRange = getMonthDateRange(from.month, from.year);
  const toRange = getMonthDateRange(to.month, to.year);

  const [fromAgg, toAgg, allTags] = await Promise.all([
    Expense.aggregate<SettlementAggRow>(tagPersonSettlementPipeline(fromRange)),
    Expense.aggregate<SettlementAggRow>(tagPersonSettlementPipeline(toRange)),
    Tag.find().sort({ sortOrder: 1 }).lean(),
  ]);

  const fromSplit = splitBySettlementType(fromAgg, allTags, persons[0].key);
  const toSplit = splitBySettlementType(toAgg, allTags, persons[0].key);

  const { deferred, immediate, headline } = buildSectionedComparison(fromSplit, toSplit, allTags);
  const hasMovers = deferred.rows.length > 0 || immediate.rows.length > 0;

  const fromLabel = formatMonthYear(from.month, from.year);
  const toLabel = formatMonthYear(to.month, to.year);

  return (
    <div className="space-y-6">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Reports
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compare Months</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          What changed from {fromLabel} to {toLabel}, and where.
        </p>
      </div>

      {!hasMovers ? (
        <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No expenses recorded in either {fromLabel} or {toLabel}.
          </p>
        </div>
      ) : (
        <>
          <ComparisonHeadline fromLabel={fromLabel} toLabel={toLabel} totals={headline} />
          {deferred.rows.length > 0 && <ComparisonSection section={deferred} />}
          {immediate.rows.length > 0 && <ComparisonSection section={immediate} />}
        </>
      )}
    </div>
  );
}
