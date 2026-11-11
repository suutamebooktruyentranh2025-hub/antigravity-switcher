const DEFAULT_CHECK_INTERVAL_MINUTES = 10;

export function normalizeAutoCheckInterval(minutes: number | null): number {
  if (
    minutes !== null &&
    Number.isInteger(minutes) &&
    minutes >= 10 &&
    minutes <= 120 &&
    minutes % 10 === 0
  ) {
    return minutes;
  }
  return DEFAULT_CHECK_INTERVAL_MINUTES;
}

export function autoCheckIntervalOptions(): number[] {
  const interval_options: number[] = [];
  for (let minutes = 10; minutes <= 120; minutes += 10) {
    interval_options.push(minutes);
  }
  return interval_options;
}
