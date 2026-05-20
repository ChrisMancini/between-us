import { parseCsv } from "@/lib/csv-parsers/parse";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";

function makeFormat(
  overrides: Partial<SerializedCsvFormat> = {}
): SerializedCsvFormat {
  return {
    _id: "fmt1",
    name: "Test Format",
    dateColumn: "Date",
    dateFormat: "MM/DD/YYYY",
    descriptionColumn: "Description",
    amountType: "separate",
    debitColumn: "Debit",
    creditColumn: "Credit",
    tagMappings: [],
    ...overrides,
  };
}

describe("parseCsv", () => {
  describe("date parsing", () => {
    it("parses MM/DD/YYYY format", () => {
      const format = makeFormat({ dateFormat: "MM/DD/YYYY" });
      const rows = [{ Date: "01/15/2025", Description: "Store", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toBe("2025-01-15");
    });

    it("parses YYYY-MM-DD format", () => {
      const format = makeFormat({ dateFormat: "YYYY-MM-DD" });
      const rows = [{ Date: "2025-01-15", Description: "Store", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].date).toBe("2025-01-15");
    });

    it("parses MM-DD-YYYY format", () => {
      const format = makeFormat({ dateFormat: "MM-DD-YYYY" });
      const rows = [{ Date: "01-15-2025", Description: "Store", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].date).toBe("2025-01-15");
    });

    it("parses DD/MM/YYYY format", () => {
      const format = makeFormat({ dateFormat: "DD/MM/YYYY" });
      const rows = [{ Date: "15/01/2025", Description: "Store", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].date).toBe("2025-01-15");
    });

    it("reports error for invalid date value", () => {
      const format = makeFormat();
      const rows = [{ Date: "not-a-date", Description: "Store", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Invalid date");
    });

    it("reports error for missing date column", () => {
      const format = makeFormat();
      const rows = [{ Date: "", Description: "Store", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Missing date");
    });

    it("reports error for unsupported date format", () => {
      const format = makeFormat({ dateFormat: "YYYY/MM/DD" as SerializedCsvFormat["dateFormat"] });
      const result = parseCsv([], format);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Unsupported date format");
    });
  });

  describe("description cleaning", () => {
    it("passes through normal descriptions", () => {
      const format = makeFormat();
      const rows = [{ Date: "01/01/2025", Description: "Publix", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].description).toBe("Publix");
    });

    it("removes card number patterns", () => {
      const format = makeFormat();
      const rows = [{ Date: "01/01/2025", Description: "PURCHASE VISA XXXXXXXXXXXX2268", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].description).toBe("PURCHASE VISA");
    });

    it("removes null + card number patterns", () => {
      const format = makeFormat();
      const rows = [{ Date: "01/01/2025", Description: "GROCERY null XXXXXXXXXXXX3550", Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].description).toBe("GROCERY");
    });

    it("truncates descriptions over 100 characters", () => {
      const format = makeFormat();
      const longDesc = "A".repeat(150);
      const rows = [{ Date: "01/01/2025", Description: longDesc, Debit: "10.00", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].description).toHaveLength(100);
    });
  });

  describe("amount parsing — separate debit/credit columns", () => {
    it("parses normal debit amount", () => {
      const format = makeFormat();
      const rows = [{ Date: "01/01/2025", Description: "Store", Debit: "25.50", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].amountCents).toBe(2550);
    });

    it("skips credit rows as payment/credit", () => {
      const format = makeFormat();
      const rows = [{ Date: "01/01/2025", Description: "Payment", Debit: "", Credit: "100.00" }];
      const result = parseCsv(rows, format);
      expect(result.transactions).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe("Payment/credit");
    });

    it("skips rows with no debit amount", () => {
      const format = makeFormat();
      const rows = [{ Date: "01/01/2025", Description: "Nothing", Debit: "", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.skipped[0].reason).toBe("No debit amount");
    });

    it("skips rows with zero debit", () => {
      const format = makeFormat();
      const rows = [{ Date: "01/01/2025", Description: "Zero", Debit: "0", Credit: "" }];
      const result = parseCsv(rows, format);
      expect(result.skipped[0].reason).toBe("Zero or invalid amount");
    });
  });

  describe("amount parsing — single column", () => {
    const singleFormat = makeFormat({
      amountType: "single",
      amountColumn: "Amount",
      purchaseSign: "positive",
    });

    it("parses positive amount with positive purchase sign", () => {
      const rows = [{ Date: "01/01/2025", Description: "Store", Amount: "42.99" }];
      const result = parseCsv(rows, singleFormat);
      expect(result.transactions[0].amountCents).toBe(4299);
    });

    it("parses negative amount with negative purchase sign", () => {
      const format = makeFormat({
        amountType: "single",
        amountColumn: "Amount",
        purchaseSign: "negative",
      });
      const rows = [{ Date: "01/01/2025", Description: "Store", Amount: "-42.99" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].amountCents).toBe(4299);
    });

    it("skips payment/credit in single column mode", () => {
      const format = makeFormat({
        amountType: "single",
        amountColumn: "Amount",
        purchaseSign: "negative",
      });
      const rows = [{ Date: "01/01/2025", Description: "Payment", Amount: "50.00" }];
      const result = parseCsv(rows, format);
      expect(result.skipped[0].reason).toBe("Payment/credit");
    });

    it("skips zero amount", () => {
      const rows = [{ Date: "01/01/2025", Description: "Zero", Amount: "0" }];
      const result = parseCsv(rows, singleFormat);
      expect(result.skipped[0].reason).toBe("Zero or invalid amount");
    });

    it("reports error for missing amount", () => {
      const rows = [{ Date: "01/01/2025", Description: "Store", Amount: "" }];
      const result = parseCsv(rows, singleFormat);
      expect(result.errors[0].message).toBe("Missing amount");
    });
  });

  describe("tag mapping", () => {
    it("maps matching source tag to tagIds", () => {
      const format = makeFormat({
        tagColumn: "Category",
        tagMappings: [{ sourceValue: "groceries", tagIds: ["tag-123"] }],
      });
      const rows = [{ Date: "01/01/2025", Description: "Store", Debit: "10.00", Credit: "", Category: "groceries" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].mappedTagIds).toEqual(["tag-123"]);
      expect(result.transactions[0].sourceTag).toBe("groceries");
    });

    it("maps case-insensitively", () => {
      const format = makeFormat({
        tagColumn: "Category",
        tagMappings: [{ sourceValue: "groceries", tagIds: ["tag-123"] }],
      });
      const rows = [{ Date: "01/01/2025", Description: "Store", Debit: "10.00", Credit: "", Category: "GROCERIES" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].mappedTagIds).toEqual(["tag-123"]);
    });

    it("leaves mappedTagIds undefined when no mapping matches", () => {
      const format = makeFormat({
        tagColumn: "Category",
        tagMappings: [{ sourceValue: "groceries", tagIds: ["tag-123"] }],
      });
      const rows = [{ Date: "01/01/2025", Description: "Store", Debit: "10.00", Credit: "", Category: "dining" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].mappedTagIds).toBeUndefined();
      expect(result.transactions[0].sourceTag).toBe("dining");
    });
  });

  describe("notes", () => {
    it("extracts notes when column is configured", () => {
      const format = makeFormat({ notesColumn: "Memo" });
      const rows = [{ Date: "01/01/2025", Description: "Store", Debit: "10.00", Credit: "", Memo: "Weekly shopping" }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].notes).toBe("Weekly shopping");
    });

    it("truncates notes over 500 characters", () => {
      const format = makeFormat({ notesColumn: "Memo" });
      const longNotes = "N".repeat(600);
      const rows = [{ Date: "01/01/2025", Description: "Store", Debit: "10.00", Credit: "", Memo: longNotes }];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].notes).toHaveLength(500);
    });
  });

  describe("row numbering", () => {
    it("uses 1-indexed + header offset for row numbers", () => {
      const format = makeFormat();
      const rows = [
        { Date: "01/01/2025", Description: "First", Debit: "10.00", Credit: "" },
        { Date: "01/02/2025", Description: "Second", Debit: "20.00", Credit: "" },
      ];
      const result = parseCsv(rows, format);
      expect(result.transactions[0].originalRow).toBe(2);
      expect(result.transactions[1].originalRow).toBe(3);
    });
  });

  describe("mixed results", () => {
    it("handles a mix of valid, skipped, and error rows", () => {
      const format = makeFormat();
      const rows = [
        { Date: "01/01/2025", Description: "Valid", Debit: "10.00", Credit: "" },
        { Date: "01/02/2025", Description: "Payment", Debit: "", Credit: "50.00" },
        { Date: "bad-date", Description: "Error", Debit: "10.00", Credit: "" },
      ];
      const result = parseCsv(rows, format);
      expect(result.transactions).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });
  });
});
