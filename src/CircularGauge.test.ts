import { describe, expect, it } from "vitest";
import { clampPercent, dialStrokeDash } from "./CircularGauge";

describe("clampPercent", () => {
  it("clamps values between 0 and 100", () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(88)).toBe(88);
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(100)).toBe(100);
  });

  it("handles non-finite values safely", () => {
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});

describe("dialStrokeDash", () => {
  it("formats strokeDasharray string correctly", () => {
    expect(dialStrokeDash(88)).toBe("88, 100");
    expect(dialStrokeDash(150)).toBe("100, 100");
    expect(dialStrokeDash(-5)).toBe("0, 100");
  });
});

