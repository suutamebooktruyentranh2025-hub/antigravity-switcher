import { expect, test } from "vitest";
import { formatQuotaClock } from "./quotaFetched";

function clock(iso: string): string {
  const fetched_at = new Date(iso);
  const hour_text = String(fetched_at.getHours()).padStart(2, "0");
  const minute_text = String(fetched_at.getMinutes()).padStart(2, "0");
  return `${hour_text}:${minute_text}`;
}

function dated_clock(iso: string): string {
  const fetched_at = new Date(iso);
  const day_text = String(fetched_at.getDate()).padStart(2, "0");
  const month_text = String(fetched_at.getMonth() + 1).padStart(2, "0");
  return `${day_text}/${month_text} ${clock(iso)}`;
}

test("quota clock shows the local time and adds the date on another day", () => {
  const now_ms = Date.parse("2026-11-11T09:51:00Z");
  expect(formatQuotaClock("2026-11-11T09:42:00Z", now_ms)).toBe(clock("2026-11-11T09:42:00Z"));
  expect(formatQuotaClock("2026-10-09T08:00:00Z", now_ms)).toBe(dated_clock("2026-10-09T08:00:00Z"));
  expect(formatQuotaClock(null, now_ms)).toBeNull();
  expect(formatQuotaClock("not-a-date", now_ms)).toBeNull();
});
