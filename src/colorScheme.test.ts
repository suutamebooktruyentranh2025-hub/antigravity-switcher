import { expect, test } from "vitest";
import { readColorScheme, resolveColorScheme } from "./colorScheme";

test("missing preference stays on the current dark theme", () => {
  expect(readColorScheme(null)).toBe("dark");
  expect(readColorScheme("sepia")).toBe("dark");
});

test("system follows the operating system", () => {
  expect(resolveColorScheme("system", true)).toBe("dark");
  expect(resolveColorScheme("system", false)).toBe("light");
  expect(resolveColorScheme("light", true)).toBe("light");
  expect(resolveColorScheme("dark", false)).toBe("dark");
});
