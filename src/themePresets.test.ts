import { expect, test } from "vitest";
import { DEFAULT_THEME_PRESET, THEME_PRESETS, readThemePreset } from "./themePresets";

test("palette list matches the twelve crawler presets", () => {
  expect(THEME_PRESETS.map((preset) => preset.id)).toEqual([
    "violet",
    "catppuccin",
    "tokyonight",
    "nord",
    "sepia",
    "oled",
    "dracula",
    "github",
    "onedark",
    "rosepine",
    "emerald",
    "cyberpunk",
  ]);
});

test("unknown palette stays on the built-in colors", () => {
  expect(readThemePreset(null)).toBe(DEFAULT_THEME_PRESET);
  expect(readThemePreset("sepia-extra")).toBe(DEFAULT_THEME_PRESET);
  expect(readThemePreset("catppuccin")).toBe("catppuccin");
});
