import { describe, expect, it } from "vitest";
import {
  countTiers,
  formatResetCountdown,
  quotaTone,
  rowsForWindow,
  visibleAccounts,
  type AccountRecord,
} from "./filterAccounts";

const accounts: AccountRecord[] = [
  {
    id: "1",
    email: "Ada@Example.com",
    tier: "PRO",
    quota: [
      { model_name: "Flash", window: "5h", percent_remaining: 100, reset_at: "2026-10-09T16:00:00Z" },
      { model_name: "Pro", window: "weekly", percent_remaining: 40, reset_at: "2026-10-16T16:00:00Z" },
    ],
    quota_refreshed_at: null,
    created_at: "2026-10-09T00:00:00Z",
    last_used_at: null,
    needs_relogin: false,
    last_error: null,
  },
  {
    id: "2",
    email: "free@example.com",
    tier: "FREE",
    quota: [],
    quota_refreshed_at: null,
    created_at: "2026-10-09T00:00:00Z",
    last_used_at: null,
    needs_relogin: false,
    last_error: null,
  },
  {
    id: "3",
    email: "ultra@example.com",
    tier: "ULTRA",
    quota: [],
    quota_refreshed_at: null,
    created_at: "2026-10-09T00:00:00Z",
    last_used_at: null,
    needs_relogin: false,
    last_error: null,
  },
  {
    id: "4",
    email: "unknown@example.com",
    tier: null,
    quota: [],
    quota_refreshed_at: null,
    created_at: "2026-10-09T00:00:00Z",
    last_used_at: null,
    needs_relogin: false,
    last_error: null,
  },
];

describe("account filters", () => {
  it("counts tiers after search and before the tier chip", () => {
    const counts = countTiers(accounts, "example.com");
    expect(counts).toEqual({ all_count: 4, pro_count: 1, ultra_count: 1, free_count: 1 });
    expect(countTiers(accounts, "ada").all_count).toBe(1);
  });

  it("keeps unknown tiers only in all", () => {
    expect(visibleAccounts(accounts, "", "FREE").map((account) => account.id)).toEqual(["2"]);
    expect(visibleAccounts(accounts, "", "ALL").map((account) => account.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("changes quota rows with the window and leaves the card list alone", () => {
    const visible = visibleAccounts(accounts, "", "ALL");
    expect(rowsForWindow(visible[0], "5h").map((row) => row.model_name)).toEqual(["Flash"]);
    expect(rowsForWindow(visible[0], "weekly").map((row) => row.model_name)).toEqual(["Pro"]);
    expect(visible).toHaveLength(4);
  });

  it("colors remaining quota like the manager", () => {
    expect(quotaTone(50)).toBe("success");
    expect(quotaTone(20)).toBe("warning");
    expect(quotaTone(19)).toBe("error");
  });

  it("formats the reset countdown", () => {
    const now_ms = Date.parse("2026-10-09T12:00:00Z");
    expect(formatResetCountdown("2026-10-09T16:54:00Z", now_ms)).toBe("4h 54m");
    expect(formatResetCountdown("2026-10-10T16:00:00Z", now_ms)).toBe("1d 4h");
  });
});
