export function formatQuotaClock(iso: string | null, now_ms: number): string | null {
  if (!iso) {
    return null;
  }
  const fetched_at = new Date(iso);
  if (Number.isNaN(fetched_at.getTime())) {
    return null;
  }
  const hour_text = String(fetched_at.getHours()).padStart(2, "0");
  const minute_text = String(fetched_at.getMinutes()).padStart(2, "0");
  const clock_text = `${hour_text}:${minute_text}`;
  const now = new Date(now_ms);
  const same_day =
    fetched_at.getFullYear() === now.getFullYear() &&
    fetched_at.getMonth() === now.getMonth() &&
    fetched_at.getDate() === now.getDate();
  if (same_day) {
    return clock_text;
  }
  const day_text = String(fetched_at.getDate()).padStart(2, "0");
  const month_text = String(fetched_at.getMonth() + 1).padStart(2, "0");
  return `${day_text}/${month_text} ${clock_text}`;
}
