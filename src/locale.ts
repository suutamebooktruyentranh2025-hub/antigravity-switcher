export type Locale = "vi" | "en";

export const LOCALE_STORAGE_KEY = "accounts_locale";

const vi_messages = {
  search_placeholder: "Tìm email...",
  week: "Tuần",
  all: "Tất cả",
  add_account: "Thêm tài khoản",
  refresh_all: "Làm mới tất cả",
  refreshing: "Đang làm mới",
  refresh: "Làm mới",
  switch_account: "Chuyển",
  delete: "Xóa",
  settings: "Cài đặt",
  relaunch: "Mở lại",
  current: "HIỆN TẠI",
  relogin: "ĐĂNG NHẬP LẠI",
  no_quota: "Chưa có hạn mức",
  fetching_quota: "Đang lấy hạn mức...",
  empty_accounts: "Chưa có tài khoản nào.",
  no_match: "Không có tài khoản khớp bộ lọc.",
  mode: "Chế độ",
  appearance: "Giao diện",
  light: "Sáng",
  dark: "Tối",
  system: "Hệ thống",
  palette: "Bảng màu",
  use_default_colors: "Dùng màu mặc định",
  using_default_colors: "Đang dùng màu mặc định của app.",
  close: "Đóng",
  language: "Ngôn ngữ",
  add_account_help: "Đăng nhập Google trên Chrome. App không hỏi mật khẩu và sẽ tự lưu khi trình duyệt chuyển về.",
  copy_link: "Copy liên kết",
  signed_in: "Tôi đã đăng nhập",
  delete_title: "Xóa {email}?",
  delete_help: "Tài khoản biến khỏi app này. Antigravity IDE giữ phiên đang đăng nhập.",
  cancel: "Hủy",
  oauth_saving: "Đã nhận mã đăng nhập. Đang lưu tài khoản...",
  oauth_opening: "Đang mở Google Chrome...",
  oauth_chrome: "Hãy đăng nhập trên Chrome. App sẽ tự lưu khi Google chuyển về.",
  oauth_chrome_failed: "Chrome không mở. Hãy copy liên kết bên dưới.",
  phase_quitting: "Đang thoát Antigravity IDE",
  phase_writing: "Đang ghi phiên",
  phase_launching: "Đang mở lại",
  theme_violet: "Tím thẫm Material 3 mặc định trang nhã",
  theme_catppuccin: "Màu pastel êm dịu, chống mỏi mắt",
  theme_tokyonight: "Xanh đêm neon phong cách Nhật Bản",
  theme_nord: "Băng tuyết Bắc Cực trong trẻo và tối giản",
  theme_sepia: "Tone màu giấy đọc sách và cafe ấm áp",
  theme_oled: "Đen sâu tuyệt đối cho màn hình OLED",
  theme_dracula: "Gothic huyền thoại được nhiều lập trình viên dùng",
  theme_github: "Chuẩn mực thanh lịch và quen thuộc từ GitHub",
  theme_onedark: "Huyền thoại Atom và VS Code One Dark Pro",
  theme_rosepine: "Pastel hoa hồng Bắc Âu tối giản và tinh tế",
  theme_emerald: "Xanh ngọc lục bảo thiên nhiên tươi mát",
  theme_cyberpunk: "Sắc màu tương lai neon rực rỡ và cá tính",
  session_expired: "Phiên hết hạn. Hãy đăng nhập lại tài khoản này.",
  ide_missing: "Máy chưa cài Antigravity IDE.",
  ide_still_running: "Antigravity IDE không chịu thoát. Phiên chưa được ghi.",
  write_failed: "Ghi phiên lỗi. Antigravity IDE đã được mở lại với phiên cũ.",
  launch_failed: "Phiên đã ghi nhưng Antigravity IDE không mở lại.",
  switch_failed: "Chuyển tài khoản lỗi.",
  missing_account: "Không thấy tài khoản {account_id}.",
  missing_token: "Không có refresh token cho {account_id}.",
  missing_oauth_client: "Thiếu ANTIGRAVITY_OAUTH_CLIENT_ID hoặc ANTIGRAVITY_OAUTH_CLIENT_SECRET.",
  login_timeout: "Hết giờ đăng nhập. Hãy thử lại.",
  login_not_started: "Chưa có lượt đăng nhập nào.",
  login_code_missing: "Chưa nhận được mã đăng nhập.",
  quota_unreachable: "Không gọi được hạn mức.",
  email_missing: "Google không trả email.",
  access_token_missing: "Google không trả access token.",
  refresh_token_missing: "Google không trả refresh token.",
  keychain_missing: "Không có refresh token trong Keychain.",
  keychain_save_failed: "Không lưu được refresh token vào Keychain.",
  ide_running: "Antigravity IDE vẫn đang chạy.",
  ide_open_failed: "Không mở được Antigravity IDE.",
  ide_not_appeared: "Antigravity IDE không xuất hiện sau khi mở.",
  session_db_missing: "Không có file SQLite của Antigravity.",
  session_write_failed: "Không ghi được phiên vào Keychain của Antigravity.",
  session_restore_failed: "Không khôi phục được phiên cũ.",
  callback_done: "Đăng nhập xong. Bạn có thể đóng tab này.",
} as const;

const en_messages: { [Key in keyof typeof vi_messages]: string } = {
  search_placeholder: "Search email...",
  week: "Week",
  all: "All",
  add_account: "Add account",
  refresh_all: "Refresh all",
  refreshing: "Refreshing",
  refresh: "Refresh",
  switch_account: "Switch",
  delete: "Delete",
  settings: "Settings",
  relaunch: "Reopen",
  current: "CURRENT",
  relogin: "SIGN IN AGAIN",
  no_quota: "No quota yet",
  fetching_quota: "Fetching quota...",
  empty_accounts: "No accounts yet.",
  no_match: "No accounts match the filter.",
  mode: "Mode",
  appearance: "Appearance",
  light: "Light",
  dark: "Dark",
  system: "System",
  palette: "Palette",
  use_default_colors: "Use default colors",
  using_default_colors: "Using the app's default colors.",
  close: "Close",
  language: "Language",
  add_account_help: "Sign in with Google in Chrome. The app never asks for your password and saves the account when the browser returns.",
  copy_link: "Copy link",
  signed_in: "I signed in",
  delete_title: "Delete {email}?",
  delete_help: "The account disappears from this app. Antigravity IDE keeps the signed-in session.",
  cancel: "Cancel",
  oauth_saving: "Sign-in code received. Saving the account...",
  oauth_opening: "Opening Google Chrome...",
  oauth_chrome: "Sign in with Chrome. The app saves the account when Google returns.",
  oauth_chrome_failed: "Chrome did not open. Copy the link below.",
  phase_quitting: "Quitting Antigravity IDE",
  phase_writing: "Writing the session",
  phase_launching: "Opening again",
  theme_violet: "Quiet Material 3 violet",
  theme_catppuccin: "Soft pastel colors that are easy on the eyes",
  theme_tokyonight: "Neon night blue with a Tokyo feel",
  theme_nord: "Clear, minimal arctic frost",
  theme_sepia: "Warm paper and coffee tones",
  theme_oled: "True black for OLED screens",
  theme_dracula: "The gothic theme many developers know",
  theme_github: "The familiar, tidy GitHub look",
  theme_onedark: "The classic Atom and VS Code One Dark Pro look",
  theme_rosepine: "Minimal rose pastel",
  theme_emerald: "Fresh emerald green",
  theme_cyberpunk: "Bright neon future colors",
  session_expired: "The session expired. Sign in to this account again.",
  ide_missing: "Antigravity IDE is not installed.",
  ide_still_running: "Antigravity IDE did not quit. The session was not written.",
  write_failed: "Writing the session failed. Antigravity IDE was reopened with the old session.",
  launch_failed: "The session was written, but Antigravity IDE did not reopen.",
  switch_failed: "Switching the account failed.",
  missing_account: "Account {account_id} was not found.",
  missing_token: "No refresh token for {account_id}.",
  missing_oauth_client: "ANTIGRAVITY_OAUTH_CLIENT_ID or ANTIGRAVITY_OAUTH_CLIENT_SECRET is missing.",
  login_timeout: "Sign-in timed out. Try again.",
  login_not_started: "No sign-in is in progress.",
  login_code_missing: "The sign-in code has not arrived.",
  quota_unreachable: "Could not fetch quota.",
  email_missing: "Google did not return an email.",
  access_token_missing: "Google did not return an access token.",
  refresh_token_missing: "Google did not return a refresh token.",
  keychain_missing: "No refresh token in Keychain.",
  keychain_save_failed: "Could not save the refresh token to Keychain.",
  ide_running: "Antigravity IDE is still running.",
  ide_open_failed: "Could not open Antigravity IDE.",
  ide_not_appeared: "Antigravity IDE did not appear after opening.",
  session_db_missing: "Antigravity's SQLite file is missing.",
  session_write_failed: "Could not write the session to Antigravity's Keychain.",
  session_restore_failed: "Could not restore the old session.",
  callback_done: "Sign-in finished. You can close this tab.",
};

export type MessageKey = keyof typeof vi_messages;

const catalogs: Record<Locale, { [Key in MessageKey]: string }> = {
  vi: vi_messages,
  en: en_messages,
};

const host_message_keys: Record<string, MessageKey> = Object.fromEntries(
  (Object.keys(vi_messages) as MessageKey[]).map((key) => [vi_messages[key], key]),
);

const host_prefixes: Array<{ prefix: string; key: MessageKey }> = [
  { prefix: "Không thấy tài khoản ", key: "missing_account" },
  { prefix: "Không có refresh token cho ", key: "missing_token" },
];

export function readLocale(saved_value: string | null): Locale {
  return saved_value === "en" ? "en" : "vi";
}

export function translate(locale: Locale, key: MessageKey, values?: Record<string, string>): string {
  const template = catalogs[locale][key];
  if (!values) {
    return template;
  }
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template,
  );
}

export function themeDescriptionKey(theme_id: string): MessageKey {
  const key = `theme_${theme_id}` as MessageKey;
  return key in vi_messages ? key : "theme_violet";
}

export function localizeHostMessage(locale: Locale, message: string): string {
  if (locale === "vi") {
    return message;
  }
  const exact_key = host_message_keys[message];
  if (exact_key) {
    return translate(locale, exact_key);
  }
  for (const entry of host_prefixes) {
    if (message.startsWith(entry.prefix) && message.endsWith(".")) {
      const account_id = message.slice(entry.prefix.length, -1);
      return translate(locale, entry.key, { account_id });
    }
  }
  return message;
}
