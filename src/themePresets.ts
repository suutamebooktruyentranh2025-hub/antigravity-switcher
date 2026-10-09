export const THEME_PRESET_STORAGE_KEY = "accounts_theme_preset";
export const DEFAULT_THEME_PRESET = "default";

export interface ThemeSwatchSet {
  light: [string, string, string];
  dark: [string, string, string];
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  swatches: ThemeSwatchSet;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "violet",
    name: "Violet Iris",
    description: "Tím thẫm Material 3 mặc định trang nhã",
    swatches: { light: ["#fafafa", "#ece7f0", "#5a3799"], dark: ["#131313", "#202020", "#cdbdff"] },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Màu pastel êm dịu, chống mỏi mắt",
    swatches: { light: ["#eff1f5", "#ccd0da", "#8839ef"], dark: ["#1e1e2e", "#313244", "#cba6f7"] },
  },
  {
    id: "tokyonight",
    name: "Tokyo Night",
    description: "Xanh đêm neon phong cách Nhật Bản",
    swatches: { light: ["#e1e2e7", "#bcbdc4", "#2e7de9"], dark: ["#1a1b26", "#24283b", "#7aa2f7"] },
  },
  {
    id: "nord",
    name: "Nord Frost",
    description: "Băng tuyết Bắc Cực trong trẻo và tối giản",
    swatches: { light: ["#eceff4", "#d8dee9", "#5e81ac"], dark: ["#242933", "#3b4252", "#88c0d0"] },
  },
  {
    id: "sepia",
    name: "Warm Coffee",
    description: "Tone màu giấy đọc sách và cafe ấm áp",
    swatches: { light: ["#fbf5eb", "#e4d7c5", "#8d5b4c"], dark: ["#1f1916", "#332a25", "#e0a98b"] },
  },
  {
    id: "oled",
    name: "Midnight OLED",
    description: "Đen sâu tuyệt đối cho màn hình OLED",
    swatches: { light: ["#ffffff", "#d1d5db", "#0f172a"], dark: ["#000000", "#1c1c1c", "#38bdf8"] },
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "Gothic huyền thoại được nhiều lập trình viên dùng",
    swatches: { light: ["#f8f8f2", "#deded6", "#7b52b9"], dark: ["#282a36", "#44475a", "#ff79c6"] },
  },
  {
    id: "github",
    name: "GitHub",
    description: "Chuẩn mực thanh lịch và quen thuộc từ GitHub",
    swatches: { light: ["#ffffff", "#f6f8fa", "#0969da"], dark: ["#0d1117", "#161b22", "#2f81f7"] },
  },
  {
    id: "onedark",
    name: "One Dark",
    description: "Huyền thoại Atom và VS Code One Dark Pro",
    swatches: { light: ["#fafafa", "#f0f0f0", "#4078f2"], dark: ["#282c34", "#21252b", "#61afef"] },
  },
  {
    id: "rosepine",
    name: "Rose Pine",
    description: "Pastel hoa hồng Bắc Âu tối giản và tinh tế",
    swatches: { light: ["#faf4ed", "#f2e9de", "#b4637a"], dark: ["#191724", "#1f1d2e", "#ebbcba"] },
  },
  {
    id: "emerald",
    name: "Emerald Forest",
    description: "Xanh ngọc lục bảo thiên nhiên tươi mát",
    swatches: { light: ["#f4f9f6", "#e6f3eb", "#059669"], dark: ["#111915", "#17231d", "#34d399"] },
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    description: "Sắc màu tương lai neon rực rỡ và cá tính",
    swatches: { light: ["#fef8ee", "#f8ebd4", "#ff007f"], dark: ["#1a102f", "#261b40", "#00f0ff"] },
  },
];

const theme_preset_ids = new Set(THEME_PRESETS.map((preset) => preset.id));

export function readThemePreset(saved_value: string | null): string {
  if (saved_value && theme_preset_ids.has(saved_value)) {
    return saved_value;
  }
  return DEFAULT_THEME_PRESET;
}
