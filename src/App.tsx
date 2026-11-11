import { useEffect, useRef, useState } from "react";
import {
  deleteAccount,
  finishOAuthLogin,
  listAccounts,
  readAppVersion,
  listenAccountsChanged,
  listenRefreshingAccount,
  listenOAuthCallback,
  listenSwitchPhase,
  parseCommandError,
  refreshAccount,
  refreshAllAccounts,
  relaunchAntigravity,
  setUiLocale,
  getAutoCheckQuota,
  getAutoCheckInterval,
  setAutoCheckQuota,
  setAutoCheckInterval,
  checkForUpdates,
  type UpdateCheckResult,
  startOAuthLogin,
  switchAccount,
} from "./api";
import { UpdateModal } from "./UpdateModal";
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
import { autoCheckIntervalOptions, normalizeAutoCheckInterval } from "./checkInterval";
import { formatQuotaClock } from "./quotaFetched";
import {
  countTiers,
  formatResetCountdown,
  isAccountCritical,
  quotaTone,
  rowsForWindow,
  visibleAccounts,
  type AccountRecord,
  type QuotaWindow,
  type TierFilter,
} from "./filterAccounts";
import { readViewMode, VIEW_MODE_STORAGE_KEY, type ViewMode } from "./viewMode";
import { CircularGauge } from "./CircularGauge";
import { formatDisplayEmail } from "./formatEmail";
import appLogo from "./assets/logo.png";

function ActionIcon({ icon_name }: { icon_name: "plus" | "refresh" | "repeat" | "switch" | "trash" | "copy" | "check" | "grid" | "list" }) {
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
      {icon_name === "copy" ? (
        <>
          <rect width="13" height="13" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </>
      ) : null}
      {icon_name === "check" ? <path d="M20 6 9 17l-5-5" /> : null}
      {icon_name === "grid" ? (
        <>
          <rect width="7" height="7" x="3" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="3" rx="1.5" />
          <rect width="7" height="7" x="14" y="14" rx="1.5" />
          <rect width="7" height="7" x="3" y="14" rx="1.5" />
        </>
      ) : null}
      {icon_name === "list" ? (
        <>
          <line x1="8" x2="21" y1="6" y2="6" />
          <line x1="8" x2="21" y1="12" y2="12" />
          <line x1="8" x2="21" y1="18" y2="18" />
          <line x1="3" x2="3.01" y1="6" y2="6" strokeWidth="2.5" />
          <line x1="3" x2="3.01" y1="12" y2="12" strokeWidth="2.5" />
          <line x1="3" x2="3.01" y1="18" y2="18" strokeWidth="2.5" />
        </>
      ) : null}
    </svg>
  );
}

function formatRelativeTime(timestamp: number, now: number, locale: Locale): string {
  const diff_sec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diff_sec < 10) {
    return translate(locale, "just_now");
  }
  if (diff_sec < 60) {
    return `${diff_sec}s`;
  }
  const diff_min = Math.floor(diff_sec / 60);
  if (diff_min < 60) {
    return `${diff_min}m`;
  }
  const diff_hr = Math.floor(diff_min / 60);
  return `${diff_hr}h`;
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

function QuotaFetchedLabel({ iso, now_ms, locale }: { iso: string | null; now_ms: number; locale: Locale }) {
  const clock_text = formatQuotaClock(iso, now_ms);
  if (!clock_text || !iso) {
    return <span className="quota-fetched-label">{translate(locale, "quota_not_fetched")}</span>;
  }
  const relative_text = formatRelativeTime(Date.parse(iso), now_ms, locale);
  return (
    <span className="quota-fetched-label" title={iso}>
      {translate(locale, "quota_fetched_at")}: <strong className="mono">{clock_text}</strong> ({relative_text})
    </span>
  );
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
  const [settings_tab, setSettingsTab] = useState<"general" | "appearance" | "about">("general");
  const [app_version, setAppVersion] = useState<string | null>(null);
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
  const [auto_check_quota, setAutoCheckQuotaState] = useState(true);
  const [auto_check_interval_minutes, setAutoCheckIntervalMinutes] = useState(10);
  const [update_info, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [checking_update, setCheckingUpdate] = useState(false);
  const [update_check_notice, setUpdateCheckNotice] = useState<string | null>(null);
  const [now_ms, setNowMs] = useState(() => Date.now());
  const [view_mode, setViewMode] = useState<ViewMode>(() => readViewMode(localStorage.getItem(VIEW_MODE_STORAGE_KEY)));
  const [hero_copied, setHeroCopied] = useState(false);
  const search_input_ref = useRef<HTMLInputElement>(null);
  const oauth_active_ref = useRef(false);
  const oauth_finishing_ref = useRef(false);
  const finish_oauth_ref = useRef<() => Promise<void>>(async () => {});

  async function reload() {
    const list = await listAccounts();
    setAccounts(list.accounts);
    setCurrentAccountId(list.current_account_id);
  }

  async function onCopyHeroEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setHeroCopied(true);
      setTimeout(() => setHeroCopied(false), 2000);
    } catch {}
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
    void readAppVersion().then(setAppVersion);
    void getAutoCheckQuota().then(setAutoCheckQuotaState);
    void getAutoCheckInterval().then((minutes) => setAutoCheckIntervalMinutes(normalizeAutoCheckInterval(minutes)));
    void checkForUpdates().then((res) => {
      if (res.has_update) {
        setUpdateInfo(res);
      }
    }).catch(() => {});
    void reload();
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    let unlisten_phase = () => {};
    let unlisten_oauth = () => {};
    let unlisten_accounts = () => {};
    let unlisten_refreshing = () => {};
    void listenSwitchPhase((event) => {
      setBusySwitchId(event.account_id);
      setSwitchPhase(event.phase);
    }).then((stop) => {
      unlisten_phase = stop;
    });
    void listenRefreshingAccount((accountId) => {
      setRefreshingId(accountId);
    }).then((stop) => {
      unlisten_refreshing = stop;
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
      unlisten_refreshing();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, view_mode);
  }, [view_mode]);

  useEffect(() => {
    const on_key_down = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        search_input_ref.current?.focus();
        search_input_ref.current?.select();
      }
    };
    window.addEventListener("keydown", on_key_down);
    return () => window.removeEventListener("keydown", on_key_down);
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
    localStorage.setItem("accounts_quota_window", quota_window);
  }, [quota_window]);

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

  const current_account = accounts.find((a) => a.id === current_account_id);
  const current_rows = current_account ? rowsForWindow(current_account, quota_window) : [];
  const is_current_critical = current_account ? isAccountCritical(current_account) : false;
  const is_current_refreshing = current_account ? (refreshing_id === "all" || refreshing_id === current_account.id) : false;
  const has_current_health_warning = current_account
    ? current_account.tier_downgraded || current_account.needs_relogin || is_current_critical
    : false;

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

  async function onToggleAutoCheck(enabled: boolean) {
    setAutoCheckQuotaState(enabled);
    await setAutoCheckQuota(enabled);
  }

  async function onChangeCheckInterval(raw_minutes: number) {
    const saved_minutes = normalizeAutoCheckInterval(raw_minutes);
    setAutoCheckIntervalMinutes(saved_minutes);
    const stored_minutes = await setAutoCheckInterval(saved_minutes);
    setAutoCheckIntervalMinutes(normalizeAutoCheckInterval(stored_minutes));
  }

  async function onManualCheckUpdates() {
    setCheckingUpdate(true);
    setUpdateCheckNotice(null);
    try {
      const res = await checkForUpdates();
      if (res.has_update) {
        setUpdateInfo(res);
      } else {
        setUpdateCheckNotice(t("already_latest_version"));
      }
    } catch (err) {
      setUpdateCheckNotice(String(err));
    } finally {
      setCheckingUpdate(false);
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

  function renderAccountGrid(account: AccountRecord) {
    const quota_rows = rowsForWindow(account, quota_window);
    const is_current = account.id === current_account_id;
    const is_switching = account.id === busy_switch_id;
    const is_refreshing = refreshing_id === "all" || refreshing_id === account.id;
    const is_critical = is_current && isAccountCritical(account);
    return (
      <article key={account.id} className={is_current ? "bento-card current" : "bento-card"}>
        <div className="bento-card-top">
          <div className="bento-card-identity">
            <span className={is_current ? "account-status-dot active" : "account-status-dot"} aria-hidden="true" />
            <div className="bento-card-meta">
              <div className="bento-card-email" title={account.email}>{formatDisplayEmail(account.email)}</div>
              <div className="badge-row">
                {account.tier ? <span className={`tier-badge ${account.tier.toLowerCase()}`}>{account.tier === "FREE" ? "FREE" : account.tier}</span> : null}
                {!is_current ? <span className="reserve-badge">{t("reserve_account")}</span> : null}
                {account.needs_relogin ? <span className="warn-badge">{t("relogin")}</span> : null}
              </div>
              <QuotaFetchedLabel iso={account.quota_refreshed_at} now_ms={now_ms} locale={locale} />
            </div>
          </div>
          <div className="bento-card-header-actions">
            <button className={is_refreshing ? "icon-button refresh-btn is-loading" : "icon-button refresh-btn"} disabled={controls_locked} aria-busy={is_refreshing} aria-label={is_refreshing ? t("refreshing") : t("refresh")} title={is_refreshing ? t("refreshing") : t("refresh")} onClick={() => void onRefreshOne(account.id)}>
              {is_refreshing ? <span className="spinner" aria-hidden="true" /> : <ActionIcon icon_name="refresh" />}
            </button>
            <button className="icon-button danger" disabled={controls_locked} aria-label={t("delete")} title={t("delete")} onClick={() => setDeleteTarget(account)}>
              <ActionIcon icon_name="trash" />
            </button>
          </div>
        </div>
        {is_critical ? (
          <div className="critical-quota-banner" role="alert">
            <span className="critical-quota-icon">🚨</span>
            <span>{t("quota_critical_warning")}</span>
          </div>
        ) : null}
        {account.tier_downgraded ? (
          <div className="tier-downgrade-banner" role="alert">
            <span className="critical-quota-icon">⚠️</span>
            <span>{t("tier_downgrade_warning")}</span>
          </div>
        ) : null}
        {account.needs_relogin ? (
          <div className="relogin-banner" role="alert">
            <span className="critical-quota-icon">🔑</span>
            <span>{t("account_relogin_warning")}</span>
          </div>
        ) : null}
        {is_switching && switch_phase ? <p className="muted">{phase_keys[switch_phase] ? t(phase_keys[switch_phase]) : switch_phase}</p> : null}
        {is_refreshing ? (
          <p className="muted loading-line">
            <span className="spinner" aria-hidden="true" />
            {t("fetching_quota")}
          </p>
        ) : null}
        {quota_rows.length === 0 ? <p className="muted">{t("no_quota")}</p> : (
          <div className="bento-mini-quotas">
            {quota_rows.map((row) => {
              const tone = quotaTone(row.percent_remaining);
              return (
                <div className={`bento-mini-bar ${tone}`} key={`${row.model_name}-${row.window}-${row.reset_at}`}>
                  <div className="bento-mini-bar-labels">
                    <span className="bento-mini-name">{row.model_name}</span>
                    <span className="bento-mini-pct mono">{row.percent_remaining}%</span>
                  </div>
                  <div className="bento-mini-track">
                    <div className="bento-mini-fill" style={{ width: `${Math.max(0, Math.min(100, row.percent_remaining))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {account.last_error ? <p className="error-text">{localizeHostMessage(locale, account.last_error)}</p> : null}
        {relaunch_account_id === account.id ? (
          <button className="card-button" disabled={controls_locked} onClick={() => void onRelaunch(account.id)}>{t("relaunch")}</button>
        ) : null}
        {!is_current ? (
          <button
            className="bento-switch-btn"
            disabled={controls_locked || account.needs_relogin}
            aria-label={t("switch_account")}
            title={t("switch_account")}
            onClick={() => void onSwitch(account.id)}
          >
            <ActionIcon icon_name="switch" />
            <span>{t("switch_to_this_account")}</span>
          </button>
        ) : (
          <div className="bento-current-indicator">
            <ActionIcon icon_name="check" />
            <span>{t("current")}</span>
          </div>
        )}
      </article>
    );
  }

  function renderAccountList(account: AccountRecord) {
    const quota_rows = rowsForWindow(account, quota_window);
    const is_current = account.id === current_account_id;
    const is_switching = account.id === busy_switch_id;
    const is_refreshing = refreshing_id === "all" || refreshing_id === account.id;
    const is_critical = is_current && isAccountCritical(account);
    const has_warning = account.tier_downgraded || account.needs_relogin || is_critical;

    return (
      <article key={account.id} className={is_current ? "account-row current" : "account-row"}>
        <div className="account-row-identity">
          <span className={is_current ? "account-status-dot active" : "account-status-dot"} aria-hidden="true" />
          <div className="account-row-details">
            <div className="account-row-email" title={account.email}>{formatDisplayEmail(account.email)}</div>
            <div className="account-row-badges">
              {account.tier ? <span className={`tier-badge ${account.tier.toLowerCase()}`}>{account.tier === "FREE" ? "FREE" : account.tier}</span> : null}
              {has_warning ? <span className="warn-badge" title={t("needs_attention")}>⚠️</span> : null}
            </div>
            <QuotaFetchedLabel iso={account.quota_refreshed_at} now_ms={now_ms} locale={locale} />
          </div>
        </div>

        <div className="account-row-quotas">
          {is_switching && switch_phase ? (
            <span className="muted">{phase_keys[switch_phase] ? t(phase_keys[switch_phase]) : switch_phase}</span>
          ) : is_refreshing ? (
            <span className="muted loading-line">
              <span className="spinner" aria-hidden="true" />
              {t("fetching_quota")}
            </span>
          ) : quota_rows.length === 0 ? (
            <span className="muted text-xs">{t("no_quota")}</span>
          ) : (
            quota_rows.slice(0, 3).map((row) => {
              const tone = quotaTone(row.percent_remaining);
              return (
                <div key={`${row.model_name}-${row.window}`} className={`compact-quota-chip ${tone}`} title={`${row.model_name}: ${row.percent_remaining}%`}>
                  <span className="compact-quota-name">{row.model_name}</span>
                  <span className="compact-quota-pct mono">{row.percent_remaining}%</span>
                </div>
              );
            })
          )}
        </div>

        <div className="account-row-actions">
          <button className={is_refreshing ? "icon-button refresh-btn is-loading" : "icon-button refresh-btn"} disabled={controls_locked} aria-busy={is_refreshing} aria-label={is_refreshing ? t("refreshing") : t("refresh")} title={is_refreshing ? t("refreshing") : t("refresh")} onClick={() => void onRefreshOne(account.id)}>
            {is_refreshing ? <span className="spinner" aria-hidden="true" /> : <ActionIcon icon_name="refresh" />}
          </button>
          {!is_current ? (
            <button
              className="action-button primary compact-switch-btn"
              disabled={controls_locked || account.needs_relogin}
              aria-label={t("switch_account")}
              title={t("switch_account")}
              onClick={() => void onSwitch(account.id)}
            >
              <ActionIcon icon_name="switch" />
              <span>{t("switch_account")}</span>
            </button>
          ) : (
            <span className="current-badge-indicator">
              <ActionIcon icon_name="check" />
              <span>{t("current")}</span>
            </span>
          )}
          <button className="icon-button danger" disabled={controls_locked} aria-label={t("delete")} title={t("delete")} onClick={() => setDeleteTarget(account)}>
            <ActionIcon icon_name="trash" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-titlebar">
        <div className="app-titlebar-brand">
          <img src={appLogo} alt="Logo" className="brand-logo-img" />
          <span className="brand-name">{t("dashboard_title")}</span>
          {app_version ? <span className="brand-version">{app_version}</span> : null}
        </div>
        <div className="app-titlebar-actions">
          <button
            className={refreshing_id === "all" ? "icon-button refresh-btn is-loading" : "icon-button refresh-btn"}
            disabled={controls_locked || accounts.length === 0}
            aria-busy={refreshing_id === "all"}
            aria-label={refreshing_id === "all" ? t("refreshing") : t("refresh_all")}
            title={refreshing_id === "all" ? t("refreshing") : t("refresh_all")}
            onClick={() => void onRefreshAll()}
          >
            {refreshing_id === "all" ? <span className="spinner" aria-hidden="true" /> : <ActionIcon icon_name="refresh" />}
          </button>
          <button className="icon-button" aria-label={t("settings")} title={t("settings")} onClick={() => { setSettingsTab("general"); setSettingsOpen(true); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* MODERN BENTO HERO GRID */}
      {current_account ? (
        <section className="bento-hero-grid" aria-label="Bento Hero Dashboard">
          {/* Tile 1: Active Account Large Card (2 columns on md) */}
          <article className="bento-tile bento-active-tile" aria-label={t("connected_ide")}>
            <div className="bento-tile-head">
              <div className="bento-active-info">
                <div className="bento-status-row">
                  <span className="bento-status-pill">
                    <span className="pulse-dot" aria-hidden="true" />
                    {t("connected_ide")}
                  </span>
                  {current_account.tier ? (
                    <span className={`tier-badge ${current_account.tier.toLowerCase()}`}>
                      {current_account.tier === "FREE" ? "FREE" : current_account.tier}
                    </span>
                  ) : null}
                  {has_current_health_warning ? (
                    <span className="bento-health-badge">
                      ⚠️ {t("needs_attention")}
                    </span>
                  ) : null}
                </div>
                <div className="bento-title-row">
                  <h1 className="bento-email">{current_account.email}</h1>
                  <button
                    type="button"
                    className="bento-copy-btn"
                    title={hero_copied ? t("copied_email") : t("copy_email")}
                    aria-label={t("copy_email")}
                    onClick={() => void onCopyHeroEmail(current_account.email)}
                  >
                    <ActionIcon icon_name={hero_copied ? "check" : "copy"} />
                  </button>
                </div>
                <div className="bento-meta-row">
                  <QuotaFetchedLabel iso={current_account.quota_refreshed_at} now_ms={now_ms} locale={locale} />
                </div>
              </div>

              <div className="bento-active-actions">
                <button
                  type="button"
                  className={is_current_refreshing ? "bento-refresh-btn is-loading" : "bento-refresh-btn"}
                  disabled={controls_locked}
                  aria-busy={is_current_refreshing}
                  onClick={() => void onRefreshOne(current_account.id)}
                >
                  {is_current_refreshing ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <ActionIcon icon_name="refresh" />
                  )}
                  <span>{is_current_refreshing ? t("refreshing") : t("refresh_quota")}</span>
                </button>
              </div>
            </div>

            {/* Dynamic Alert Banners inside Bento Active Tile */}
            <div className="bento-banners">
              {current_account.tier_downgraded ? (
                <div className="tier-downgrade-banner" role="alert">
                  <span className="critical-quota-icon">⚠️</span>
                  <span>{t("tier_downgrade_warning")}</span>
                </div>
              ) : null}
              {is_current_critical ? (
                <div className="critical-quota-banner" role="alert">
                  <span className="critical-quota-icon">🚨</span>
                  <span>{t("quota_critical_warning")}</span>
                </div>
              ) : null}
              {current_account.needs_relogin ? (
                <div className="relogin-banner" role="alert">
                  <span className="critical-quota-icon">🔑</span>
                  <span>{t("account_relogin_warning")}</span>
                </div>
              ) : null}
            </div>

            {/* Circular Gauges Row */}
            {current_rows.length === 0 ? (
              <p className="bento-no-quota">{t("no_quota")}</p>
            ) : (
              <div className="bento-gauges-row">
                {current_rows.map((row) => (
                  <CircularGauge
                    key={`bento-hero-${row.model_name}-${row.window}-${row.reset_at}`}
                    model_name={row.model_name}
                    percent={row.percent_remaining}
                    reset_text={formatResetCountdown(row.reset_at, now_ms) || "N/A"}
                    window_label={row.window === "5h" ? "5H" : t("week")}
                  />
                ))}
              </div>
            )}
          </article>

          {/* Tile 2: System Telemetry & Quick Action (1 column on md) */}
          <aside className="bento-tile bento-telemetry-tile">
            <div className="bento-telemetry-head">
              <span className="bento-telemetry-badge">⚡ TELEMETRY</span>
              <h3 className="bento-telemetry-title">{t("system_status")}</h3>
            </div>

            <div className="bento-telemetry-metrics">
              <div className="bento-metric-row">
                <span className="bento-metric-label">Antigravity IDE</span>
                <span className="bento-metric-value active-val">
                  <span className="pulse-dot-sm" aria-hidden="true" />
                  {t("ide_running_status")}
                </span>
              </div>
              <div className="bento-metric-row">
                <span className="bento-metric-label">{t("auto_check_quota")}</span>
                <span className="bento-metric-value mono">{auto_check_interval_minutes}m</span>
              </div>
              <div className="bento-metric-row">
                <span className="bento-metric-label">{t("available_accounts")}</span>
                <span className="bento-metric-value mono font-bold">{accounts.length}</span>
              </div>
            </div>

            <button
              type="button"
              className="bento-telemetry-add-btn"
              onClick={() => void onStartOAuth()}
            >
              <ActionIcon icon_name="plus" />
              <span>{t("add_account")}</span>
            </button>
          </aside>
        </section>
      ) : null}

      <header className="toolbar">
        <input
          ref={search_input_ref}
          className="search-input"
          placeholder={`${t("search_placeholder")} (⌘F)`}
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
        <div className="segment view-mode-segment">
          <button className={view_mode === "grid" ? "segment-button active" : "segment-button"} title={t("view_grid")} aria-label={t("view_grid")} onClick={() => setViewMode("grid")}>
            <ActionIcon icon_name="grid" />
          </button>
          <button className={view_mode === "list" ? "segment-button active" : "segment-button"} title={t("view_list")} aria-label={t("view_list")} onClick={() => setViewMode("list")}>
            <ActionIcon icon_name="list" />
          </button>
        </div>
      </header>

      {accounts.length === 0 ? (
        <section className="empty-state">
          <p>{t("empty_accounts")}</p>
          <button className="action-button primary" aria-label={t("add_account")} title={t("add_account")} onClick={() => void onStartOAuth()}>
            <ActionIcon icon_name="plus" />
            <span>{t("add_account")}</span>
          </button>
        </section>
      ) : visible.length === 0 ? (
        <section className="empty-state">
          <p>{t("no_match")}</p>
        </section>
      ) : (
        <section className={view_mode === "list" ? "card-list" : "card-grid"}>
          {visible.map((account) => view_mode === "list" ? renderAccountList(account) : renderAccountGrid(account))}
        </section>
      )}

      {settings_open ? (
        <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <div className="dialog settings-dialog-v2" role="dialog" aria-modal="true" aria-label={t("settings")}>
            {/* Modal Header */}
            <header className="settings-modal-header">
              <div className="settings-header-brand">
                <div className="settings-header-icon" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                  </svg>
                </div>
                <div>
                  <h2 className="settings-header-title">{t("settings")}</h2>
                  <p className="settings-header-subtitle">{t("settings_subtitle")}</p>
                </div>
              </div>
              <button
                type="button"
                className="settings-close-btn"
                aria-label={t("close")}
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </header>

            {/* Split Body */}
            <div className="settings-body-split">
              {/* Left Sidebar */}
              <aside className="settings-sidebar">
                <nav className="settings-nav">
                  <button
                    type="button"
                    className={`settings-nav-btn ${settings_tab === "general" ? "active" : ""}`}
                    onClick={() => setSettingsTab("general")}
                  >
                    <span className="settings-nav-icon">🌐</span>
                    <span>{t("settings_general")}</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-nav-btn ${settings_tab === "appearance" ? "active" : ""}`}
                    onClick={() => setSettingsTab("appearance")}
                  >
                    <span className="settings-nav-icon">🎨</span>
                    <span>{t("settings_appearance")}</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-nav-btn ${settings_tab === "about" ? "active" : ""}`}
                    onClick={() => setSettingsTab("about")}
                  >
                    <span className="settings-nav-icon">🚀</span>
                    <span>{t("settings_about")}</span>
                  </button>
                </nav>

                <div className="settings-sidebar-appinfo">
                  <div className="appinfo-name">Antigravity Switcher</div>
                  <div className="appinfo-badge">v{app_version || "0.1.7"} • Stable</div>
                </div>
              </aside>

              {/* Right Content Pane */}
              <main className="settings-content-pane">
                {settings_tab === "general" && (
                  <div className="settings-pane-section-group">
                    {/* Section: Language */}
                    <div className="settings-card-section">
                      <div className="settings-row-split">
                        <div>
                          <h3 className="settings-card-title">{t("display_language")}</h3>
                          <p className="settings-card-desc">{t("language_desc")}</p>
                        </div>
                        <div className="segment">
                          <button className={locale === "vi" ? "segment-button active" : "segment-button"} onClick={() => setLocale("vi")}>Tiếng Việt</button>
                          <button className={locale === "en" ? "segment-button active" : "segment-button"} onClick={() => setLocale("en")}>English</button>
                        </div>
                      </div>
                    </div>

                    {/* Section: Auto Quota Check */}
                    <div className="settings-card-section">
                      <div className="settings-row-split top-aligned">
                        <div className="settings-row-content">
                          <div className="settings-title-badge-row">
                            <h3 className="settings-card-title">{t("auto_check_quota")}</h3>
                            <span className="settings-badge-recommended">{t("recommended")}</span>
                          </div>
                          <p className="settings-card-desc">{t("auto_check_quota_desc")}</p>
                        </div>
                        <div className="settings-check-controls">
                          <select
                            className="settings-interval-select"
                            aria-label={t("auto_check_interval")}
                            disabled={!auto_check_quota}
                            value={auto_check_interval_minutes}
                            onChange={(event) => void onChangeCheckInterval(Number(event.target.value))}
                          >
                            {autoCheckIntervalOptions().map((minutes) => (
                              <option key={minutes} value={minutes}>
                                {t("interval_minutes", { minutes: String(minutes) })}
                              </option>
                            ))}
                          </select>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={auto_check_quota}
                              onChange={(event) => void onToggleAutoCheck(event.target.checked)}
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Section: Default Quota Window */}
                    <div className="settings-card-section">
                      <div className="settings-row-split">
                        <div>
                          <h3 className="settings-card-title">{t("quota_window_default")}</h3>
                          <p className="settings-card-desc">{t("quota_window_default_desc")}</p>
                        </div>
                        <div className="segment">
                          <button className={quota_window === "5h" ? "segment-button active" : "segment-button"} onClick={() => setQuotaWindow("5h")}>{t("quota_session_5h")}</button>
                          <button className={quota_window === "weekly" ? "segment-button active" : "segment-button"} onClick={() => setQuotaWindow("weekly")}>{t("quota_weekly")}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settings_tab === "appearance" && (
                  <div className="settings-pane-section-group">
                    {/* Section: Mode */}
                    <div className="settings-card-section">
                      <div className="settings-row-split">
                        <div>
                          <h3 className="settings-card-title">{t("mode")}</h3>
                          <p className="settings-card-desc">{t("appearance_desc")}</p>
                        </div>
                        <div className="segment">
                          <button className={color_scheme === "light" ? "segment-button active" : "segment-button"} onClick={() => setColorScheme("light")}>☀️ {t("light")}</button>
                          <button className={color_scheme === "dark" ? "segment-button active" : "segment-button"} onClick={() => setColorScheme("dark")}>🌙 {t("dark")}</button>
                          <button className={color_scheme === "system" ? "segment-button active" : "segment-button"} onClick={() => setColorScheme("system")}>💻 {t("system")}</button>
                        </div>
                      </div>
                    </div>

                    {/* Section: Palette */}
                    <div className="settings-card-section">
                      <div className="settings-row-split palette-header">
                        <div>
                          <h3 className="settings-card-title">{t("palette")}</h3>
                          <p className="settings-card-desc">{t("palette_desc")}</p>
                        </div>
                        {theme_preset !== DEFAULT_THEME_PRESET ? (
                          <button type="button" className="settings-reset-link" onClick={() => setThemePreset(DEFAULT_THEME_PRESET)}>
                            {t("use_default_colors")}
                          </button>
                        ) : null}
                      </div>

                      <div className="theme-grid-v2">
                        {THEME_PRESETS.map((preset) => {
                          const selected = theme_preset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              className={`theme-card-v2 ${selected ? "selected" : ""}`}
                              aria-pressed={selected}
                              onClick={() => setThemePreset(preset.id)}
                            >
                              <div className="theme-card-v2-main">
                                <div className="theme-card-v2-swatches">
                                  {preset.swatches[resolved_scheme].map((swatch_color) => (
                                    <span key={swatch_color} className="swatch-bubble" style={{ background: swatch_color }} />
                                  ))}
                                </div>
                                <div className="theme-card-v2-info">
                                  <div className="theme-card-v2-name">{preset.name}</div>
                                  <div className="theme-card-v2-desc">{t(themeDescriptionKey(preset.id))}</div>
                                </div>
                              </div>
                              {selected ? <span className="theme-card-v2-check">✓</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {settings_tab === "about" && (
                  <div className="settings-pane-section-group">
                    <div className="settings-about-hero-card">
                      <div className="settings-about-logo-wrap">
                        <img src={appLogo} alt="Logo" className="settings-about-logo" />
                      </div>
                      <h3 className="settings-about-name">Antigravity Switcher</h3>
                      <p className="settings-about-purpose">{t("app_purpose")}</p>
                      <div className="settings-about-version-badge">
                        {t("current_version_label", { version: app_version || "0.1.7" })}
                      </div>

                      <div className="settings-about-update-box">
                        <div className="settings-about-update-status">
                          <span className="status-indicator-dot" />
                          <span className="status-indicator-text">
                            {update_check_notice ? update_check_notice : t("already_latest_version")}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="settings-check-update-btn"
                          disabled={checking_update}
                          onClick={() => void onManualCheckUpdates()}
                        >
                          {checking_update ? (
                            <>
                              <span className="spinner" aria-hidden="true" />
                              <span>{t("checking_for_updates")}</span>
                            </>
                          ) : (
                            t("check_for_updates")
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </main>
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

      {update_info && update_info.has_update ? (
        <UpdateModal
          update_info={update_info}
          locale={locale}
          onClose={() => setUpdateInfo(null)}
        />
      ) : null}
    </main>
  );
}
