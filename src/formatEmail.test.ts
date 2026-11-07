import { describe, expect, it } from "vitest";
import { formatDisplayEmail } from "./formatEmail";

describe("formatDisplayEmail", () => {
  it("strips @gmail.com suffix", () => {
    expect(formatDisplayEmail("linhnv2590@gmail.com")).toBe("linhnv2590");
    expect(formatDisplayEmail("nvlinh2590100@gmail.com")).toBe("nvlinh2590100");
  });

  it("strips @googlemail.com suffix", () => {
    expect(formatDisplayEmail("testuser@googlemail.com")).toBe("testuser");
  });

  it("preserves non-gmail email addresses", () => {
    expect(formatDisplayEmail("admin@company.ai")).toBe("admin@company.ai");
  });

  it("handles empty or invalid strings safely", () => {
    expect(formatDisplayEmail("")).toBe("");
    expect(formatDisplayEmail("simpleuser")).toBe("simpleuser");
  });
});

