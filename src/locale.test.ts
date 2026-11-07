import { expect, test } from "vitest";
import { localizeHostMessage, readLocale, themeDescriptionKey, translate } from "./locale";

test("a missing language stays Vietnamese", () => {
  expect(readLocale(null)).toBe("vi");
  expect(readLocale("fr")).toBe("vi");
  expect(readLocale("en")).toBe("en");
});

test("english replaces placeholders and known host messages", () => {
  expect(translate("en", "delete_title", { email: "ada@example.com" })).toBe("Delete ada@example.com?");
  expect(translate("en", "connected_ide")).toBe("Connected to Antigravity IDE");
  expect(translate("vi", "connected_ide")).toBe("Đang kết nối Antigravity IDE");
  expect(translate("vi", "system_status")).toBe("Trạng thái hệ thống");
  expect(translate("en", "system_status")).toBe("System Status");
  expect(translate("vi", "current")).toBe("Hiện tại");
  expect(translate("en", "current")).toBe("Current");
  expect(translate("vi", "dashboard_title")).toBe("Bảng điều khiển tài khoản");
  expect(translate("en", "dashboard_title")).toBe("Account Dashboard");
  expect(translate("vi", "settings_general")).toBe("Chung & Hạn mức");
  expect(translate("en", "settings_general")).toBe("General & Quota");
  expect(translate("vi", "settings_appearance")).toBe("Giao diện & Theme");
  expect(translate("en", "settings_appearance")).toBe("Appearance & Theme");
  expect(translate("vi", "settings_about")).toBe("Cập nhật & App");
  expect(translate("en", "settings_about")).toBe("Updates & App");
  expect(translate("vi", "quota_window_default")).toBe("Khung giờ hạn mức mặc định");
  expect(translate("en", "quota_window_default")).toBe("Default quota window");
  expect(translate("vi", "recommended")).toBe("Khuyên dùng");
  expect(translate("en", "recommended")).toBe("Recommended");
  expect(translate("vi", "switch_to_this_account")).toBe("Chuyển sang tài khoản này");
  expect(localizeHostMessage("en", "Máy chưa cài Antigravity IDE.")).toBe("Antigravity IDE is not installed.");
  expect(localizeHostMessage("en", "Không thấy tài khoản sample-pro.")).toBe("Account sample-pro was not found.");
  expect(localizeHostMessage("vi", "Máy chưa cài Antigravity IDE.")).toBe("Máy chưa cài Antigravity IDE.");
  expect(localizeHostMessage("en", "unexpected detail")).toBe("unexpected detail");
});

test("theme descriptions follow the preset id", () => {
  expect(themeDescriptionKey("nord")).toBe("theme_nord");
  expect(themeDescriptionKey("missing")).toBe("theme_violet");
});
