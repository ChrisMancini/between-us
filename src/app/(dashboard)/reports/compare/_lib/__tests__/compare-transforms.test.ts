import {
  buildComparison,
  buildHeadline,
  sortMovers,
  type CompareRow,
} from "../compare-transforms";
import type { TagTotal } from "../../../_lib/report-transforms";

// Build a TagTotal the way `buildTagTotals` would, so tests exercise the same
// shape the transform receives at runtime.
function total(
  tagPath: string,
  person1Paid: number,
  person2Paid: number
): TagTotal {
  const segments = tagPath.split("/");
  return {
    tagPath,
    tagName: segments[segments.length - 1],
    settlementType: "deferred",
    person1Paid,
    person2Paid,
    total: person1Paid + person2Paid,
  };
}

// `buildTagTotals` emits a zero row for every known tag; the transform must
// ignore those (no spend → not a present mover).
function zero(tagPath: string): TagTotal {
  return total(tagPath, 0, 0);
}

const tag = (path: string, sortOrder: number) => ({ path, sortOrder });

function rowByPath(rows: CompareRow[], path: string): CompareRow {
  const row = rows.find((r) => r.path === path);
  if (!row) throw new Error(`no row for "${path}" in [${rows.map((r) => r.path).join(", ")}]`);
  return row;
}

describe("buildComparison — parent rollup (prefix-sum by path)", () => {
  it("rolls a parent up from itself plus everything under it", () => {
    const from = [total("Bills/Electric", 100, 0), total("Bills/Water", 0, 50)];
    const to = [total("Bills/Electric", 150, 0), total("Bills/Water", 0, 50)];
    const rows = buildComparison(from, to, [
      tag("Bills/Electric", 1),
      tag("Bills/Water", 2),
    ]);

    expect(rows).toHaveLength(1);
    const bills = rowByPath(rows, "Bills");
    expect(bills.fromTotal).toBe(150);
    expect(bills.toTotal).toBe(200);
    expect(bills.delta).toBe(50);
  });

  it("surfaces a parent that exists only as a path prefix (no parent Tag entity)", () => {
    const from = [total("Bills/Electric", 100, 0)];
    const to = [total("Bills/Electric", 120, 0)];
    // Note: allTags has the child but NOT a "Bills" entity.
    const rows = buildComparison(from, to, [tag("Bills/Electric", 5)]);

    const bills = rowByPath(rows, "Bills");
    expect(bills.path).toBe("Bills");
    expect(bills.delta).toBe(20);
    // Falls back to the smallest descendant sortOrder for the tie-break.
    expect(bills.sortOrder).toBe(5);
  });

  it("includes spend tagged directly at the parent path in the rollup", () => {
    const from = [total("Bills", 30, 0), total("Bills/Electric", 100, 0)];
    const to = [total("Bills", 30, 0), total("Bills/Electric", 100, 0)];
    const rows = buildComparison(from, to, [tag("Bills", 1), tag("Bills/Electric", 2)]);

    expect(rowByPath(rows, "Bills").fromTotal).toBe(130);
  });

  it("does not match a sibling that merely shares a name prefix", () => {
    // "Billing" must not roll into "Bills".
    const from = [total("Bills/Electric", 100, 0), total("Billing", 40, 0)];
    const to = [total("Bills/Electric", 100, 0), total("Billing", 40, 0)];
    const rows = buildComparison(from, to, [tag("Bills/Electric", 1), tag("Billing", 2)]);

    expect(rowByPath(rows, "Bills").fromTotal).toBe(100);
    expect(rowByPath(rows, "Billing").fromTotal).toBe(40);
  });

  it("ignores zero-spend tags so no spurious parents appear", () => {
    const from = [zero("Gym"), total("Dining", 100, 0)];
    const to = [zero("Gym"), total("Dining", 100, 0)];
    const rows = buildComparison(from, to, [tag("Gym", 1), tag("Dining", 2)]);

    expect(rows.map((r) => r.path)).toEqual(["Dining"]);
  });
});

describe("buildComparison — accepted co-tag double-count", () => {
  it("counts an expense tagged both parent and child once per tag, and it cancels in the delta", () => {
    // A single $50 expense co-tagged "Bills" and "Bills/Electric" appears in both
    // tag totals. The rollup sums both (=$100 shown), but because it is identical
    // in both months the delta is driven purely by the real change elsewhere.
    const from = [total("Bills", 50, 0), total("Bills/Electric", 50, 0)];
    const to = [total("Bills", 50, 0), total("Bills/Electric", 80, 0)];
    const rows = buildComparison(from, to, [tag("Bills", 1), tag("Bills/Electric", 2)]);

    const bills = rowByPath(rows, "Bills");
    expect(bills.fromTotal).toBe(100); // double-counted, by design
    expect(bills.toTotal).toBe(130);
    expect(bills.delta).toBe(30); // the co-tagged $50 cancels; only the +$30 shows
  });
});

describe("buildComparison — delta, status, and suppressed percentage", () => {
  const allTags = [tag("Dining", 1)];

  it("marks an increase as up with a positive percentage", () => {
    const rows = buildComparison([total("Dining", 100, 0)], [total("Dining", 150, 0)], allTags);
    const d = rowByPath(rows, "Dining");
    expect(d.status).toBe("up");
    expect(d.delta).toBe(50);
    expect(d.pct).toBeCloseTo(50);
  });

  it("marks a decrease as down with a negative percentage", () => {
    const rows = buildComparison([total("Dining", 100, 0)], [total("Dining", 60, 0)], allTags);
    const d = rowByPath(rows, "Dining");
    expect(d.status).toBe("down");
    expect(d.delta).toBe(-40);
    expect(d.pct).toBeCloseTo(-40);
  });

  it("marks an unchanged tag as steady with 0%", () => {
    const rows = buildComparison([total("Dining", 100, 0)], [total("Dining", 100, 0)], allTags);
    const d = rowByPath(rows, "Dining");
    expect(d.status).toBe("steady");
    expect(d.delta).toBe(0);
    expect(d.pct).toBe(0);
  });

  it("marks a tag present only in the comparison month as new with suppressed percentage and null from", () => {
    const rows = buildComparison([], [total("Dining", 450, 0)], allTags);
    const d = rowByPath(rows, "Dining");
    expect(d.status).toBe("new");
    expect(d.fromTotal).toBe(0);
    expect(d.from).toBeNull();
    expect(d.delta).toBe(450);
    expect(d.pct).toBeNull(); // no fake +100%
  });

  it("marks a tag present only in the baseline month as gone with suppressed percentage and null to", () => {
    const rows = buildComparison([total("Dining", 300, 0)], [], allTags);
    const d = rowByPath(rows, "Dining");
    expect(d.status).toBe("gone");
    expect(d.toTotal).toBe(0);
    expect(d.to).toBeNull();
    expect(d.delta).toBe(-300);
    expect(d.pct).toBeNull();
  });
});

describe("buildComparison — per-person totals carried through", () => {
  it("carries person1/person2 paid for each present month", () => {
    const rows = buildComparison(
      [total("Bills/Electric", 100, 40)],
      [total("Bills/Electric", 120, 60)],
      [tag("Bills/Electric", 1)]
    );
    const bills = rowByPath(rows, "Bills");
    expect(bills.from).toEqual({ person1Paid: 100, person2Paid: 40, total: 140 });
    expect(bills.to).toEqual({ person1Paid: 120, person2Paid: 60, total: 180 });
  });
});

describe("buildComparison — sort order", () => {
  it("sorts by absolute dollar change descending, interleaving increases and decreases", () => {
    const from = [total("A", 100, 0), total("B", 500, 0), total("C", 300, 0)];
    const to = [total("A", 400, 0), total("B", 300, 0), total("C", 300, 0)];
    // deltas: A +300, B −200, C 0  → order by |Δ|: A(300), B(200), C(0)
    const rows = buildComparison(from, to, [tag("A", 1), tag("B", 2), tag("C", 3)]);
    expect(rows.map((r) => r.path)).toEqual(["A", "B", "C"]);
  });

  it("breaks ties on equal magnitude by the tag's sortOrder ascending", () => {
    const from = [total("Later", 0, 0), total("Earlier", 0, 0)];
    const to = [total("Later", 100, 0), total("Earlier", 100, 0)];
    // both +100; Earlier has the smaller sortOrder so it wins the tie.
    const rows = buildComparison(from, to, [tag("Earlier", 1), tag("Later", 9)]);
    expect(rows.map((r) => r.path)).toEqual(["Earlier", "Later"]);
  });
});

describe("sortMovers", () => {
  it("orders a raw row list by |delta| then sortOrder in place", () => {
    const rows = [
      { path: "small", delta: 10, sortOrder: 1 },
      { path: "big", delta: -900, sortOrder: 2 },
      { path: "tieA", delta: 50, sortOrder: 5 },
      { path: "tieB", delta: -50, sortOrder: 3 },
    ] as CompareRow[];
    sortMovers(rows);
    expect(rows.map((r) => r.path)).toEqual(["big", "tieB", "tieA", "small"]);
  });
});

describe("buildHeadline — combined household total", () => {
  it("sums the movers so the headline reconciles with the list", () => {
    const rows = buildComparison(
      [total("Dining", 100, 0), total("Bills/Electric", 200, 0)],
      [total("Dining", 150, 0), total("Bills/Electric", 250, 0)],
      [tag("Dining", 1), tag("Bills/Electric", 2)]
    );
    const headline = buildHeadline(rows);
    expect(headline.fromTotal).toBe(300);
    expect(headline.toTotal).toBe(400);
    expect(headline.delta).toBe(100);
    expect(headline.status).toBe("up");
    expect(headline.pct).toBeCloseTo(33.33);
  });

  it("reads as new when the baseline month is empty (no fake percentage)", () => {
    const rows = buildComparison([], [total("Dining", 500, 0)], [tag("Dining", 1)]);
    const headline = buildHeadline(rows);
    expect(headline.fromTotal).toBe(0);
    expect(headline.status).toBe("new");
    expect(headline.pct).toBeNull();
  });

  it("returns a steady zero headline for two empty months", () => {
    const headline = buildHeadline(buildComparison([], [], []));
    expect(headline).toEqual({
      fromTotal: 0,
      toTotal: 0,
      delta: 0,
      pct: null,
      status: "steady",
    });
  });
});
