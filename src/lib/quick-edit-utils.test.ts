import { describe, expect, it } from "vitest";
import { parseQuickEditCommission } from "./quick-edit-utils";

describe("parseQuickEditCommission", () => {
  it("preserves negative and zero commission values", () => {
    expect(parseQuickEditCommission("-8866")).toBe(-8866);
    expect(parseQuickEditCommission("0")).toBe(0);
  });

  it("rejects empty and incomplete numeric values", () => {
    expect(parseQuickEditCommission("")).toBeNull();
    expect(parseQuickEditCommission("-")).toBeNull();
    expect(parseQuickEditCommission("abc")).toBeNull();
  });
});
