import { describe, expect, it } from "vitest";
import { readViewMode, VIEW_MODE_STORAGE_KEY } from "./viewMode";

describe("readViewMode", () => {
  it("defaults to grid when null or invalid", () => {
    expect(readViewMode(null)).toBe("grid");
    expect(readViewMode("unknown")).toBe("grid");
    expect(readViewMode("")).toBe("grid");
  });

  it("reads list and grid correctly", () => {
    expect(readViewMode("list")).toBe("list");
    expect(readViewMode("grid")).toBe("grid");
  });

  it("exports correct storage key", () => {
    expect(VIEW_MODE_STORAGE_KEY).toBe("accounts_view_mode");
  });
});
