import { isDuplicateKeyError } from "@/lib/utils";

describe("isDuplicateKeyError", () => {
  it("returns true for MongoDB duplicate key error", () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
  });

  it("returns true with extra properties", () => {
    expect(isDuplicateKeyError({ code: 11000, message: "dup key" })).toBe(true);
  });

  it("returns false for different error code", () => {
    expect(isDuplicateKeyError({ code: 11001 })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isDuplicateKeyError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isDuplicateKeyError(undefined)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isDuplicateKeyError("error")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isDuplicateKeyError(42)).toBe(false);
  });

  it("returns false for object without code property", () => {
    expect(isDuplicateKeyError({})).toBe(false);
  });

  it("returns false for code as string", () => {
    expect(isDuplicateKeyError({ code: "11000" })).toBe(false);
  });
});
