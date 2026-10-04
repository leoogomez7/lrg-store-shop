import { describe, expect, it } from "vitest";
import {
  parseDollarDelimitedProductLine,
  parseLocalizedImportPrice,
  replaceSubcategorySuffix,
} from "./product-import-utils";

describe("product text import parsing", () => {
  it("uses the text before the dollar sign as the name and the amount after it as price", () => {
    expect(parseDollarDelimitedProductLine("FIFA 23 - PS4 $ 34.999")).toEqual({
      name: "FIFA 23 - PS4",
      price: 34_999,
    });
  });

  it("parses Argentine thousands and decimal separators", () => {
    expect(parseDollarDelimitedProductLine("GTA VI - PS5 $ 135.983,50")).toEqual({
      name: "GTA VI - PS5",
      price: 135_983.5,
    });
    expect(parseLocalizedImportPrice("1,299.99")).toBe(1_299.99);
  });

  it("does not misread a number in the product name as its price", () => {
    expect(parseDollarDelimitedProductLine("FIFA 23 $ 39.999")).toEqual({
      name: "FIFA 23",
      price: 39_999,
    });
  });

  it("appends and changes the subcategory suffix without duplicating it", () => {
    expect(replaceSubcategorySuffix("FIFA 23", "", "PS5 - PS Plus")).toBe(
      "FIFA 23 - PS5 - PS Plus",
    );
    expect(replaceSubcategorySuffix("FIFA 23 - PS5", "", "PS5")).toBe("FIFA 23 - PS5");
    expect(replaceSubcategorySuffix("FIFA 23 - PS5", "PS5", "PS4")).toBe("FIFA 23 - PS4");
  });
});