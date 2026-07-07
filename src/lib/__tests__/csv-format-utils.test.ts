import { serializeCsvFormat } from "@/lib/csv-format-utils";

describe("serializeCsvFormat", () => {
  it("serializes a format with all fields", () => {
    const result = serializeCsvFormat({
      _id: "abc123",
      name: "Chase",
      dateColumn: "Date",
      dateFormat: "MM/DD/YYYY",
      descriptionColumn: "Description",
      amountType: "separate",
      debitColumn: "Debit",
      creditColumn: "Credit",
      amountColumn: "Amount",
      purchaseSign: "negative",
      tagColumn: "Category",
      notesColumn: "Notes",
      tagMappings: [
        { sourceValue: "Groceries", tagIds: ["id1", "id2"] },
      ],
    });

    expect(result).toEqual({
      _id: "abc123",
      name: "Chase",
      dateColumn: "Date",
      dateFormat: "MM/DD/YYYY",
      descriptionColumn: "Description",
      amountType: "separate",
      debitColumn: "Debit",
      creditColumn: "Credit",
      amountColumn: "Amount",
      purchaseSign: "negative",
      tagColumn: "Category",
      notesColumn: "Notes",
      tagMappings: [
        { sourceValue: "Groceries", tagIds: ["id1", "id2"] },
      ],
    });
  });

  it("serializes optional fields as undefined when absent", () => {
    const result = serializeCsvFormat({
      _id: "def456",
      name: "Amex",
      dateColumn: "Date",
      dateFormat: "YYYY-MM-DD",
      descriptionColumn: "Desc",
      amountType: "single",
      tagMappings: [],
    });

    expect(result).toEqual({
      _id: "def456",
      name: "Amex",
      dateColumn: "Date",
      dateFormat: "YYYY-MM-DD",
      descriptionColumn: "Desc",
      amountType: "single",
      debitColumn: undefined,
      creditColumn: undefined,
      amountColumn: undefined,
      purchaseSign: undefined,
      tagColumn: undefined,
      notesColumn: undefined,
      tagMappings: [],
    });
  });

  it("falls back to empty array when tagMappings is falsy", () => {
    const result = serializeCsvFormat({
      _id: "ghi789",
      name: "Discover",
      dateColumn: "Date",
      dateFormat: "MM-DD-YYYY",
      descriptionColumn: "Desc",
      amountType: "single",
      tagMappings: null,
    });

    expect(result.tagMappings).toEqual([]);
  });

  it("stringifies ObjectId-like tagIds", () => {
    const objectId = { toString: () => "objectid123" };

    const result = serializeCsvFormat({
      _id: "jkl012",
      name: "BofA",
      dateColumn: "Date",
      dateFormat: "MM/DD/YYYY",
      descriptionColumn: "Desc",
      amountType: "separate",
      tagMappings: [
        { sourceValue: "Dining", tagIds: [objectId] },
      ],
    });

    expect(result.tagMappings).toEqual([
      { sourceValue: "Dining", tagIds: ["objectid123"] },
    ]);
  });

  it("falls back to empty array when tagIds is falsy", () => {
    const result = serializeCsvFormat({
      _id: "mno345",
      name: "Wells",
      dateColumn: "Date",
      dateFormat: "DD/MM/YYYY",
      descriptionColumn: "Desc",
      amountType: "single",
      tagMappings: [
        { sourceValue: "Gas", tagIds: null },
      ],
    });

    expect(result.tagMappings).toEqual([
      { sourceValue: "Gas", tagIds: [] },
    ]);
  });
});
