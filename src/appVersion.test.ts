import { expect, test } from "vitest";
import { visibleAppVersion } from "./appVersion";

test("a blank version stays hidden", () => {
  expect(visibleAppVersion(null)).toBeNull();
  expect(visibleAppVersion("   ")).toBeNull();
});

test("a real version is shown as typed", () => {
  expect(visibleAppVersion(" 0.1.0 ")).toBe("0.1.0");
});
