import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AccountRecord } from "./filterAccounts";

export interface AccountList {
  accounts: AccountRecord[];
  current_account_id: string | null;
}

export interface OAuthStart {
  url: string;
  browser_opened: boolean;
}

export interface SwitchPhaseEvent {
  account_id: string;
  phase: string;
}

export interface CommandError {
  code: string;
  message: string;
}

const sample_accounts: AccountRecord[] = [
  {
    id: "sample-pro",
    email: "ada@example.com",
    tier: "PRO",
    quota: [
      { model_name: "Gemini 3 Flash", window: "5h", percent_remaining: 100, reset_at: "2026-10-09T20:00:00Z" },
      { model_name: "Claude Sonnet 4.6", window: "5h", percent_remaining: 8, reset_at: "2026-10-10T16:00:00Z" },
      { model_name: "Gemini 3.1 Pro", window: "weekly", percent_remaining: 80, reset_at: "2026-10-16T12:00:00Z" },
    ],
    quota_refreshed_at: "2026-10-09T08:00:00Z",
    created_at: "2026-10-09T08:00:00Z",
    last_used_at: null,
    needs_relogin: false,
    last_error: null,
  },
  {
    id: "sample-free",
    email: "free@example.com",
    tier: "FREE",
    quota: [],
    quota_refreshed_at: null,
    created_at: "2026-10-09T08:00:00Z",
    last_used_at: null,
    needs_relogin: false,
    last_error: null,
  },
];

let preview_accounts = sample_accounts;
let preview_current_id: string | null = "sample-pro";

function tauriReady(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function parseCommandError(error: unknown): CommandError {
  const raw = String(error);
  try {
    const parsed = JSON.parse(raw) as CommandError;
    if (parsed && typeof parsed.message === "string") {
      return parsed;
    }
  } catch {
    // Plain string errors from the host stay as-is.
  }
  return { code: "error", message: raw };
}

export async function setUiLocale(locale: string): Promise<void> {
  if (!tauriReady()) {
    return;
  }
  await invoke("set_ui_locale", { locale });
}

export async function listAccounts(): Promise<AccountList> {
  if (!tauriReady()) {
    return { accounts: preview_accounts, current_account_id: preview_current_id };
  }
  return invoke<AccountList>("list_accounts");
}

export async function startOAuthLogin(): Promise<OAuthStart> {
  if (!tauriReady()) {
    return { url: "https://accounts.google.com", browser_opened: false };
  }
  return invoke<OAuthStart>("start_oauth_login");
}

export async function finishOAuthLogin(): Promise<AccountRecord> {
  if (!tauriReady()) {
    throw new Error("Đăng nhập Google chỉ chạy trong app macOS.");
  }
  return invoke<AccountRecord>("finish_oauth_login");
}

export async function refreshAccount(account_id: string): Promise<AccountRecord> {
  if (!tauriReady()) {
    return preview_accounts.find((account) => account.id === account_id) ?? preview_accounts[0];
  }
  return invoke<AccountRecord>("refresh_account", { accountId: account_id });
}

export async function refreshAllAccounts(): Promise<AccountRecord[]> {
  if (!tauriReady()) {
    return preview_accounts;
  }
  return invoke<AccountRecord[]>("refresh_all_accounts");
}

export async function switchAccount(account_id: string): Promise<AccountRecord> {
  if (!tauriReady()) {
    preview_current_id = account_id;
    const account = preview_accounts.find((item) => item.id === account_id);
    if (!account) {
      throw new Error("Không thấy tài khoản.");
    }
    return account;
  }
  return invoke<AccountRecord>("switch_account", { accountId: account_id });
}

export async function relaunchAntigravity(): Promise<void> {
  if (!tauriReady()) {
    return;
  }
  return invoke("relaunch_antigravity");
}

export async function deleteAccount(account_id: string): Promise<void> {
  if (!tauriReady()) {
    preview_accounts = preview_accounts.filter((account) => account.id !== account_id);
    if (preview_current_id === account_id) {
      preview_current_id = null;
    }
    return;
  }
  return invoke("delete_account", { accountId: account_id });
}

export async function listenAccountsChanged(handler: () => void): Promise<UnlistenFn> {
  if (!tauriReady()) {
    return () => {};
  }
  return listen("accounts-changed", () => handler());
}

export async function listenOAuthCallback(handler: () => void): Promise<UnlistenFn> {
  if (!tauriReady()) {
    return () => {};
  }
  return listen("oauth-callback-received", () => handler());
}

export async function listenSwitchPhase(
  handler: (event: SwitchPhaseEvent) => void,
): Promise<UnlistenFn> {
  if (!tauriReady()) {
    return () => {};
  }
  return listen<SwitchPhaseEvent>("switch-phase", (event) => handler(event.payload));
}
