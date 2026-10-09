import { expect, test } from "vitest";
import { localizeHostMessage, readLocale, themeDescriptionKey, translate } from "./locale";

test("a missing language stays Vietnamese", () => {
  expect(readLocale(null)).toBe("vi");
  expect(readLocale("fr")).toBe("vi");
  expect(readLocale("en")).toBe("en");
});

test("english replaces placeholders and known host messages", () => {
  expect(translate("en", "delete_title", { email: "ada@example.com" })).toBe("Delete ada@example.com?");
  expect(localizeHostMessage("en", "Máy chưa cài Antigravity IDE.")).toBe("Antigravity IDE is not installed.");
  expect(localizeHostMessage("en", "Không thấy tài khoản sample-pro.")).toBe("Account sample-pro was not found.");
  expect(localizeHostMessage("vi", "Máy chưa cài Antigravity IDE.")).toBe("Máy chưa cài Antigravity IDE.");
  expect(localizeHostMessage("en", "unexpected detail")).toBe("unexpected detail");
});

test("theme descriptions follow the preset id", () => {
  expect(themeDescriptionKey("nord")).toBe("theme_nord");
  expect(themeDescriptionKey("missing")).toBe("theme_violet");
});
