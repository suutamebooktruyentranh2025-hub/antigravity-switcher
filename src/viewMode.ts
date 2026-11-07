export type ViewMode = "grid" | "list";

export const VIEW_MODE_STORAGE_KEY = "accounts_view_mode";

export function readViewMode(raw: string | null): ViewMode {
  return raw === "list" ? "list" : "grid";
}
