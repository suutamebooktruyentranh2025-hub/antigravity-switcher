export type ColorScheme = "light" | "dark" | "system";
export type ResolvedScheme = "light" | "dark";

export const COLOR_SCHEME_STORAGE_KEY = "accounts_color_scheme";

export function readColorScheme(saved_value: string | null): ColorScheme {
  if (saved_value === "light" || saved_value === "dark" || saved_value === "system") {
    return saved_value;
  }
  return "dark";
}

export function resolveColorScheme(color_scheme: ColorScheme, system_dark: boolean): ResolvedScheme {
  if (color_scheme === "system") {
    return system_dark ? "dark" : "light";
  }
  return color_scheme;
}
