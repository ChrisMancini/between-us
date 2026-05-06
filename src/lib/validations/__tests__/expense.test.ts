import { expenseUpdateApiSchema } from "@/lib/validations/expense";

const validPayload = {
  date: "2026-05-01",
  categoryId: "507f1f77bcf86cd799439011",
  amount: 4250,
  where: "Publix",
  notes: "Groceries",
  splitType: "split" as const,
};

describe("expenseUpdateApiSchema", () => {
  it("accepts a valid update payload", () => {
    const result = expenseUpdateApiSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("strips paidBy if provided", () => {
    const result = expenseUpdateApiSchema.safeParse({
      ...validPayload,
      paidBy: "john",
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("paidBy");
  });

  it("rejects missing date", () => {
    expect(
      expenseUpdateApiSchema.safeParse({ ...validPayload, date: undefined }).success
    ).toBe(false);
  });

  it("rejects missing categoryId", () => {
    expect(
      expenseUpdateApiSchema.safeParse({ ...validPayload, categoryId: undefined }).success
    ).toBe(false);
  });

  it("rejects missing where", () => {
    expect(
      expenseUpdateApiSchema.safeParse({ ...validPayload, where: undefined }).success
    ).toBe(false);
  });

  it("rejects amount of 0", () => {
    const result = expenseUpdateApiSchema.safeParse({ ...validPayload, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = expenseUpdateApiSchema.safeParse({ ...validPayload, amount: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer amount", () => {
    const result = expenseUpdateApiSchema.safeParse({ ...validPayload, amount: 10.5 });
    expect(result.success).toBe(false);
  });

  it("accepts payload without notes", () => {
    const result = expenseUpdateApiSchema.safeParse({
      ...validPayload,
      notes: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("rejects where exceeding 100 characters", () => {
    const result = expenseUpdateApiSchema.safeParse({
      ...validPayload,
      where: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid splitType", () => {
    const result = expenseUpdateApiSchema.safeParse({
      ...validPayload,
      splitType: "half",
    });
    expect(result.success).toBe(false);
  });

  it("accepts splitType full", () => {
    const result = expenseUpdateApiSchema.safeParse({
      ...validPayload,
      splitType: "full",
    });
    expect(result.success).toBe(true);
  });
});
