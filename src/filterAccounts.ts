export type QuotaWindow = "5h" | "weekly";
export type TierFilter = "ALL" | "PRO" | "ULTRA" | "FREE";
export type QuotaTone = "success" | "warning" | "error";
export interface QuotaRow {
  model_name: string;
  window: string;
  percent_remaining: number;
  reset_at: string;
}

export interface AccountRecord {
  id: string;
  email: string;
  tier: string | null;
  quota: QuotaRow[];
  quota_refreshed_at: string | null;
  created_at: string;
  last_used_at: string | null;
  needs_relogin: boolean;
  last_error: string | null;
}

export interface TierCounts {
  all_count: number;
  pro_count: number;
  ultra_count: number;
  free_count: number;
}

export function matchesEmail(email: string, search_query: string): boolean {
  const needle = search_query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return email.toLowerCase().includes(needle);
}

export function countTiers(accounts: AccountRecord[], search_query: string): TierCounts {
  const matched_accounts = accounts.filter((account) => matchesEmail(account.email, search_query));
  return {
    all_count: matched_accounts.length,
    pro_count: matched_accounts.filter((account) => account.tier === "PRO").length,
    ultra_count: matched_accounts.filter((account) => account.tier === "ULTRA").length,
    free_count: matched_accounts.filter((account) => account.tier === "FREE").length,
  };
}

export function visibleAccounts(
  accounts: AccountRecord[],
  search_query: string,
  tier_filter: TierFilter,
): AccountRecord[] {
  return accounts.filter((account) => {
    if (!matchesEmail(account.email, search_query)) {
      return false;
    }
    if (tier_filter === "ALL") {
      return true;
    }
    return account.tier === tier_filter;
  });
}

export function quotaTone(percent_remaining: number): QuotaTone {
  if (percent_remaining >= 50) {
    return "success";
  }
  if (percent_remaining >= 20) {
    return "warning";
  }
  return "error";
}

export function rowsForWindow(account: AccountRecord, quota_window: QuotaWindow): QuotaRow[] {
  return account.quota.filter((row) => row.window === quota_window);
}

export function formatResetCountdown(reset_at: string, now_ms: number): string {
  const reset_ms = Date.parse(reset_at);
  if (Number.isNaN(reset_ms)) {
    return "";
  }
  const total_minutes = Math.floor(Math.max(0, reset_ms - now_ms) / 60000);
  const day_count = Math.floor(total_minutes / (60 * 24));
  const hour_count = Math.floor((total_minutes % (60 * 24)) / 60);
  const minute_count = total_minutes % 60;
  if (day_count > 0) {
    return `${day_count}d ${hour_count}h`;
  }
  if (hour_count > 0) {
    return `${hour_count}h ${minute_count}m`;
  }
  return `${minute_count}m`;
}
