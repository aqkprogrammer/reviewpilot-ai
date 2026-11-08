import { describe, expect, it } from "vitest";
import { cn, formatCurrency, formatNumber, formatPercent, initials, titleCase } from "./utils";

describe("utils", () => {
  it("merges tailwind classes with later wins", () => {
    expect(cn("px-2 text-sm", "px-4", false && "hidden")).toBe("text-sm px-4");
  });

  it("formats numbers in the Indian system", () => {
    expect(formatNumber(1234567)).toBe("12,34,567");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
    expect(formatNumber(15300, { compact: true })).toMatch(/15\.3\s?K/i);
  });

  it("formats percentages from ratios", () => {
    expect(formatPercent(0.3182)).toBe("31.8%");
    expect(formatPercent(1, 0)).toBe("100%");
    expect(formatPercent(undefined)).toBe("—");
  });

  it("formats paise as rupees", () => {
    expect(formatCurrency(199900)).toBe("₹1,999");
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(500000, "USD")).toBe("$5,000");
  });

  it("derives initials and title case", () => {
    expect(initials("Kunal Malhotra")).toBe("KM");
    expect(initials("  priya ")).toBe("P");
    expect(initials(null)).toBe("?");
    expect(titleCase("grace_period")).toBe("Grace Period");
  });
});
