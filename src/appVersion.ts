export function visibleAppVersion(raw_version: string | null | undefined): string | null {
  const trimmed_version = raw_version?.trim() ?? "";
  return trimmed_version.length > 0 ? trimmed_version : null;
}
