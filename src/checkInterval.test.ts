import { expect, test } from "vitest";
import { autoCheckIntervalOptions, normalizeAutoCheckInterval } from "./checkInterval";

test("check interval stays on a ten-minute step between 10 and 120", () => {
  expect(normalizeAutoCheckInterval(null)).toBe(10);
  expect(normalizeAutoCheckInterval(10)).toBe(10);
  expect(normalizeAutoCheckInterval(120)).toBe(120);
  expect(normalizeAutoCheckInterval(15)).toBe(10);
  expect(normalizeAutoCheckInterval(0)).toBe(10);
  expect(normalizeAutoCheckInterval(130)).toBe(10);
  expect(autoCheckIntervalOptions()).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
});
