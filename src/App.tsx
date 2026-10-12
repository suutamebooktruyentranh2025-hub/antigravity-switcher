import { useEffect, useRef, useState } from "react";
import {
  deleteAccount,
  finishOAuthLogin,
  listAccounts,
  listenAccountsChanged,
  listenOAuthCallback,
  listenSwitchPhase,
  parseCommandError,
  refreshAccount,
  refreshAllAccounts,
  relaunchAntigravity,
  setUiLocale,
  startOAuthLogin,
  switchAccount,
} from "./api";
import { COLOR_SCHEME_STORAGE_KEY, readColorScheme, resolveColorScheme, type ColorScheme, type ResolvedScheme } from "./colorScheme";
import { copyLinkMessageKey, copyLinkPhaseAfterWrite, type CopyLinkPhase } from "./copyLink";
import { DEFAULT_THEME_PRESET, THEME_PRESET_STORAGE_KEY, THEME_PRESETS, readThemePreset } from "./themePresets";
import {
  LOCALE_STORAGE_KEY,
  localizeHostMessage,
  readLocale,
  themeDescriptionKey,
  translate,
  type Locale,
  type MessageKey,
} from "./locale";
import {
  countTiers,
  formatResetCountdown,
  quotaTone,
  rowsForWindow,
  visibleAccounts,
  type AccountRecord,
  type QuotaWindow,
  type TierFilter,
} from "./filterAccounts";

function ActionIcon({ icon_name }: { icon_name: "plus" | "refresh" | "repeat" | "switch" | "trash" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {icon_name === "plus" ? <path d="M12 5v14M5 12h14" /> : null}
      {icon_name === "refresh" ? (
        <>
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </>
      ) : null}
      {icon_name === "repeat" ? (
        <>
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </>
      ) : null}
      {icon_name === "switch" ? (
        <>
          <path d="M8 3 4 7l4 4" />
          <path d="M4 7h16" />
          <path d="M16 21l4-4-4-4" />
          <path d="M20 17H4" />
        </>
      ) : null}
      {icon_name === "trash" ? (
        <>
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M10 11v6M14 11v6" />
        </>
      ) : null}
    </svg>
  );
}

const phase_keys: Record<string, MessageKey> = {
  quitting: "phase_quitting",
  writing: "phase_writing",
  launching: "phase_launching",
};

function storedColorScheme(): ColorScheme {
  return readColorScheme(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY));
}

function storedThemePreset(): string {
  return readThemePreset(localStorage.getItem(THEME_PRESET_STORAGE_KEY));
}

function storedLocale(): Locale {
  return readLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
}

function storedQuotaWindow(): QuotaWindow {
  const saved = localStorage.getItem("accounts_quota_window");
  return saved === "weekly" ? "weekly" : "5h";
}

export function App() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [current_account_id, setCurrentAccountId] = useState<string | null>(null);
  const [search_query, setSearchQuery] = useState("");
  const [quota_window, setQuotaWindow] = useState<QuotaWindow>(storedQuotaWindow);
  const [tier_filter, setTierFilter] = useState<TierFilter>("ALL");
  const [color_scheme, setColorScheme] = useState<ColorScheme>(storedColorScheme);
  const [theme_preset, setThemePreset] = useState(storedThemePreset);
  const [locale, setLocale] = useState<Locale>(storedLocale);
  const [system_dark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [settings_open, setSettingsOpen] = useState(false);
  const [busy_switch_id, setBusySwitchId] = useState<string | null>(null);
  const [switch_phase, setSwitchPhase] = useState<string | null>(null);
  const [refreshing_id, setRefreshingId] = useState<string | null>(null);
  const [relaunch_account_id, setRelaunchAccountId] = useState<string | null>(null);
  const [add_open, setAddOpen] = useState(false);
  const [oauth_url, setOauthUrl] = useState("");
  const [copy_link_phase, setCopyLinkPhase] = useState<CopyLinkPhase>("idle");
  const [oauth_notice, setOauthNotice] = useState<{ key: MessageKey } | { text: string } | null>(null);
  const [oauth_failed, setOauthFailed] = useState(false);
  const [delete_target, setDeleteTarget] = useState<AccountRecord | null>(null);
  const [now_ms, setNowMs] = useState(() => Date.now());
  const oauth_active_ref = useRef(false);
  const oauth_finishing_ref = useRef(false);
  const finish_oauth_ref = useRef<() => Promise<void>>(async () => {});

  async function reload() {
    const list = await listAccounts();
    setAccounts(list.accounts);
    setCurrentAccountId(list.current_account_id);
  }

  async function onFinishOAuth() {
    if (oauth_finishing_ref.current || !oauth_active_ref.current) {
      return;
    }
    oauth_finishing_ref.current = true;
    oauth_active_ref.current = false;
    setOauthFailed(false);
    setOauthNotice({ key: "oauth_saving" });
    try {
      await finishOAuthLogin();
      setAddOpen(false);
      setOauthUrl("");
      setOauthNotice(null);
      setCopyLinkPhase("idle");
      await reload();
    } catch (error) {
      oauth_active_ref.current = true;
      setOauthFailed(true);
      setOauthNotice({ text: parseCommandError(error).message });
    } finally {
      oauth_finishing_ref.current = false;
    }
  }

  finish_oauth_ref.current = onFinishOAuth;

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    let unlisten_phase = () => {};
    let unlisten_oauth = () => {};
    let unlisten_accounts = () => {};
    void listenSwitchPhase((event) => {
      setBusySwitchId(event.account_id);
      setSwitchPhase(event.phase);
    }).then((stop) => {
      unlisten_phase = stop;
    });
    void listenAccountsChanged(() => {
      setBusySwitchId(null);
      setSwitchPhase(null);
      void reload();
    }).then((stop) => {
      unlisten_accounts = stop;
    });
    void listenOAuthCallback(() => {
      void finish_oauth_ref.current();
    }).then((stop) => {
      unlisten_oauth = stop;
    });
    return () => {
      window.clearInterval(timer);
      unlisten_phase();
      unlisten_oauth();
      unlisten_accounts();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("accounts_quota_window", quota_window);
  }, [quota_window]);

  useEffect(() => {
    const media_query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply_scheme = () => {
      const next_dark = media_query.matches;
      setSystemDark(next_dark);
      document.documentElement.dataset.colorScheme = resolveColorScheme(color_scheme, next_dark);
    };
    apply_scheme();
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, color_scheme);
    media_query.addEventListener("change", apply_scheme);
    return () => media_query.removeEventListener("change", apply_scheme);
  }, [color_scheme]);

  useEffect(() => {
    if (theme_preset === DEFAULT_THEME_PRESET) {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme_preset;
    }
    localStorage.setItem(THEME_PRESET_STORAGE_KEY, theme_preset);
  }, [theme_preset]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    void setUiLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!settings_open) {
      return;
    }
    const on_key_down = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", on_key_down);
    return () => window.removeEventListener("keydown", on_key_down);
  }, [settings_open]);

  const resolved_scheme: ResolvedScheme = resolveColorScheme(color_scheme, system_dark);
  const t = (key: MessageKey, values?: Record<string, string>) => translate(locale, key, values);
  const oauth_message = oauth_notice
    ? "key" in oauth_notice
      ? t(oauth_notice.key)
      : localizeHostMessage(locale, oauth_notice.text)
    : "";
  const counts = countTiers(accounts, search_query);
  const visible = visibleAccounts(accounts, search_query, tier_filter);
  const controls_locked = busy_switch_id !== null || refreshing_id !== null;

  async function onRefreshAll() {
    setRefreshingId("all");
    try {
      const next_accounts = await refreshAllAccounts();
      setAccounts(next_accounts);
    } finally {
      setRefreshingId(null);
    }
  }

  async function onRefreshOne(account_id: string) {
    setRefreshingId(account_id);
    try {
      const updated = await refreshAccount(account_id);
      setAccounts((current) => current.map((account) => (account.id === updated.id ? updated : account)));
    } finally {
      setRefreshingId(null);
    }
  }

  async function onSwitch(account_id: string) {
    setRelaunchAccountId(null);
    setBusySwitchId(account_id);
    setSwitchPhase("quitting");
    try {
      const updated = await switchAccount(account_id);
      setCurrentAccountId(updated.id);
      setAccounts((current) => current.map((account) => (account.id === updated.id ? { ...updated, last_error: null } : account)));
    } catch (error) {
      const parsed = parseCommandError(error);
      setRelaunchAccountId(parsed.code === "launch_failed" ? account_id : null);
      setAccounts((current) =>
        current.map((account) =>
          account.id === account_id ? { ...account, last_error: parsed.message, needs_relogin: parsed.code === "relogin" } : account,
        ),
      );
    } finally {
      setBusySwitchId(null);
      setSwitchPhase(null);
    }
  }

  async function onRelaunch(account_id: string) {
    setRefreshingId(`relaunch:${account_id}`);
    try {
      await relaunchAntigravity();
      setRelaunchAccountId(null);
      setAccounts((current) =>
        current.map((account) => (account.id === account_id ? { ...account, last_error: null } : account)),
      );
      await reload();
    } catch (error) {
      setAccounts((current) =>
        current.map((account) =>
          account.id === account_id ? { ...account, last_error: parseCommandError(error).message } : account,
        ),
      );
    } finally {
      setRefreshingId(null);
    }
  }

  async function onCopyOauthLink() {
    try {
      await navigator.clipboard.writeText(oauth_url);
      setCopyLinkPhase(copyLinkPhaseAfterWrite(true));
    } catch {
      setCopyLinkPhase(copyLinkPhaseAfterWrite(false));
    }
  }

  async function onStartOAuth() {
    setOauthFailed(false);
    setOauthNotice({ key: "oauth_opening" });
    setCopyLinkPhase("idle");
    setAddOpen(true);
    try {
      const started = await startOAuthLogin();
      oauth_active_ref.current = true;
      setOauthUrl(started.url);
      setOauthFailed(!started.browser_opened);
      setOauthNotice({ key: started.browser_opened ? "oauth_chrome" : "oauth_chrome_failed" });
    } catch (error) {
      oauth_active_ref.current = false;
      setOauthFailed(true);
      setOauthNotice({ text: parseCommandError(error).message });
    }
  }

  async function onConfirmDelete() {
    if (!delete_target) {
      return;
    }
    try {
      await deleteAccount(delete_target.id);
      if (current_account_id === delete_target.id) {
        setCurrentAccountId(null);
      }
      setDeleteTarget(null);
      await reload();
    } catch (error) {
      setAccounts((current) =>
        current.map((account) =>
          account.id === delete_target.id ? { ...account, last_error: parseCommandError(error).message } : account,
        ),
      );
      setDeleteTarget(null);
    }
  }

  function renderAccount(account: AccountRecord) {
    const quota_rows = rowsForWindow(account, quota_window);
    const is_current = account.id === current_account_id;
    const is_switching = account.id === busy_switch_id;
    const is_refreshing = refreshing_id === "all" || refreshing_id === account.id;
    return (
      <article key={account.id} className={is_current ? "account-card current" : "account-card"}>
        <div className="card-head">
          <div className="email" title={account.email}>{account.email}</div>
          <div className="badge-row">
            {account.tier ? <span className={`tier-badge ${account.tier.toLowerCase()}`}>{account.tier === "FREE" ? "FREE" : account.tier}</span> : null}
            {is_current ? <span className="current-badge">{t("current")}</span> : null}
            {account.needs_relogin ? <span className="warn-badge">{t("relogin")}</span> : null}
          </div>
        </div>
        {is_switching && switch_phase ? <p className="muted">{phase_keys[switch_phase] ? t(phase_keys[switch_phase]) : switch_phase}</p> : null}
        {is_refreshing ? (
          <p className="muted loading-line">
            <span className="spinner" aria-hidden="true" />
            {t("fetching_quota")}
          </p>
        ) : null}
        {quota_rows.length === 0 ? <p className="muted">{t("no_quota")}</p> : (
          <div className="quota-list">
            {quota_rows.map((row) => {
              const tone = quotaTone(row.percent_remaining);
              return (
                <div className={`quota-bar ${tone}`} key={`${row.model_name}-${row.window}-${row.reset_at}`} title={row.model_name}>
                  <span className="quota-fill" style={{ width: `${Math.max(0, Math.min(100, row.percent_remaining))}%` }} />
                  <span className="quota-name">{row.model_name}</span>
                  <span className="quota-reset">{formatResetCountdown(row.reset_at, now_ms) || "N/A"}</span>
                  <span className="quota-percent">{row.percent_remaining}%</span>
                </div>
              );
            })}
          </div>
        )}
        {account.last_error ? <p className="error-text">{localizeHostMessage(locale, account.last_error)}</p> : null}
        {relaunch_account_id === account.id ? (
          <button className="card-button" disabled={controls_locked} onClick={() => void onRelaunch(account.id)}>{t("relaunch")}</button>
        ) : null}
        <div className="card-actions">
          <button className={is_refreshing ? "icon-button is-loading" : "icon-button"} disabled={controls_locked} aria-busy={is_refreshing} aria-label={is_refreshing ? t("refreshing") : t("refresh")} title={is_refreshing ? t("refreshing") : t("refresh")} onClick={() => void onRefreshOne(account.id)}>
            {is_refreshing ? <span className="spinner" aria-hidden="true" /> : <ActionIcon icon_name="refresh" />}
          </button>
          <button
            className="icon-button primary"
            disabled={controls_locked || is_current || account.needs_relogin}
            aria-label={t("switch_account")}
            title={t("switch_account")}
            onClick={() => void onSwitch(account.id)}
          >
            <ActionIcon icon_name="switch" />
          </button>
          <button className="icon-button danger" disabled={controls_locked} aria-label={t("delete")} title={t("delete")} onClick={() => setDeleteTarget(account)}>
            <ActionIcon icon_name="trash" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className="app-shell">
      <header className="toolbar">
        <input
          className="search-input"
          placeholder={t("search_placeholder")}
          value={search_query}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <div className="segment">
          <button className={quota_window === "5h" ? "segment-button active" : "segment-button"} onClick={() => setQuotaWindow("5h")}>5H</button>
          <button className={quota_window === "weekly" ? "segment-button active" : "segment-button"} onClick={() => setQuotaWindow("weekly")}>{t("week")}</button>
        </div>
        <div className="segment filter-segment">
          <button className={tier_filter === "ALL" ? "segment-button active" : "segment-button"} onClick={() => setTierFilter("ALL")}>{t("all")} <span>{counts.all_count}</span></button>
          <button className={tier_filter === "PRO" ? "segment-button active" : "segment-button"} onClick={() => setTierFilter("PRO")}>PRO <span>{counts.pro_count}</span></button>
          <button className={tier_filter === "ULTRA" ? "segment-button active" : "segment-button"} onClick={() => setTierFilter("ULTRA")}>ULTRA <span>{counts.ultra_count}</span></button>
          <button className={tier_filter === "FREE" ? "segment-button active" : "segment-button"} onClick={() => setTierFilter("FREE")}>FREE <span>{counts.free_count}</span></button>
        </div>
        <div className="toolbar-spacer" />
        <button className="icon-button primary" aria-label={t("add_account")} title={t("add_account")} onClick={() => void onStartOAuth()}>
          <ActionIcon icon_name="plus" />
        </button>
        <button className={refreshing_id === "all" ? "icon-button is-loading" : "icon-button"} disabled={controls_locked || accounts.length === 0} aria-busy={refreshing_id === "all"} aria-label={refreshing_id === "all" ? t("refreshing") : t("refresh_all")} title={refreshing_id === "all" ? t("refreshing") : t("refresh_all")} onClick={() => void onRefreshAll()}>
          {refreshing_id === "all" ? <span className="spinner" aria-hidden="true" /> : <ActionIcon icon_name="repeat" />}
        </button>
        <button className="icon-button" aria-label={t("settings")} onClick={() => setSettingsOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </header>

      {accounts.length === 0 ? (
        <section className="empty-state">
          <p>{t("empty_accounts")}</p>
          <button className="icon-button primary" aria-label={t("add_account")} title={t("add_account")} onClick={() => void onStartOAuth()}>
            <ActionIcon icon_name="plus" />
          </button>
        </section>
      ) : visible.length === 0 ? (
        <section className="empty-state">
          <p>{t("no_match")}</p>
        </section>
      ) : (
        <section className="card-grid">
          {visible.map((account) => renderAccount(account))}
        </section>
      )}

      {settings_open ? (
        <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <div className="dialog settings-dialog" role="dialog" aria-label={t("settings")}>
            <h2>{t("settings")}</h2>
            <p className="field-label">{t("language")}</p>
            <div className="segment" aria-label={t("language")}>
              <button className={locale === "vi" ? "segment-button active" : "segment-button"} onClick={() => setLocale("vi")}>Tiếng Việt</button>
              <button className={locale === "en" ? "segment-button active" : "segment-button"} onClick={() => setLocale("en")}>English</button>
            </div>
            <p className="field-label">{t("mode")}</p>
            <div className="segment" aria-label={t("appearance")}>
              <button className={color_scheme === "light" ? "segment-button active" : "segment-button"} onClick={() => setColorScheme("light")}>{t("light")}</button>
              <button className={color_scheme === "dark" ? "segment-button active" : "segment-button"} onClick={() => setColorScheme("dark")}>{t("dark")}</button>
              <button className={color_scheme === "system" ? "segment-button active" : "segment-button"} onClick={() => setColorScheme("system")}>{t("system")}</button>
            </div>
            <p className="field-label">{t("palette")}</p>
            <div className="theme-grid">
              {THEME_PRESETS.map((preset) => {
                const selected = theme_preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={selected ? "theme-card selected" : "theme-card"}
                    aria-pressed={selected}
                    onClick={() => setThemePreset(preset.id)}
                  >
                    <span className="theme-card-head">
                      <span className="swatch-row">
                        {preset.swatches[resolved_scheme].map((swatch_color) => (
                          <span key={swatch_color} className="swatch" style={{ background: swatch_color }} />
                        ))}
                      </span>
                      <span className="theme-check" />
                    </span>
                    <span className="theme-name">{preset.name}</span>
                    <span className="theme-description">{t(themeDescriptionKey(preset.id))}</span>
                  </button>
                );
              })}
            </div>
            {theme_preset !== DEFAULT_THEME_PRESET ? (
              <button className="action-button" onClick={() => setThemePreset(DEFAULT_THEME_PRESET)}>{t("use_default_colors")}</button>
            ) : (
              <p className="muted">{t("using_default_colors")}</p>
            )}
            <div className="dialog-actions">
              <button className="action-button" onClick={() => setSettingsOpen(false)}>{t("close")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {add_open ? (
        <div className="dialog-backdrop">
          <div className="dialog">
            <h2>{t("add_account")}</h2>
            <p className="muted">{t("add_account_help")}</p>
            {oauth_url ? <div className="link-box">{oauth_url}</div> : null}
            {oauth_message ? <p className={oauth_failed ? "error-text" : "muted"}>{oauth_message}</p> : null}
            <div className="dialog-actions">
              <button className="action-button" onClick={() => { oauth_active_ref.current = false; setCopyLinkPhase("idle"); setAddOpen(false); }}>{t("close")}</button>
              <button className={copy_link_phase === "copied" ? "action-button copied" : "action-button"} disabled={!oauth_url} aria-live="polite" onClick={() => void onCopyOauthLink()}>{t(copyLinkMessageKey(copy_link_phase))}</button>
              <button className="action-button primary" disabled={!oauth_url} onClick={() => { oauth_active_ref.current = true; void onFinishOAuth(); }}>{t("signed_in")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {delete_target ? (
        <div className="dialog-backdrop">
          <div className="dialog">
            <h2>{t("delete_title", { email: delete_target.email })}</h2>
            <p className="muted">{t("delete_help")}</p>
            <div className="dialog-actions">
              <button className="action-button" onClick={() => setDeleteTarget(null)}>{t("cancel")}</button>
              <button className="action-button danger" onClick={() => void onConfirmDelete()}>{t("delete")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
