/**
 * Strips redundant @gmail.com or @googlemail.com suffix for compact, clean display
 * in reserve cards and account rows. Non-gmail domains are preserved.
 */
export function formatDisplayEmail(email: string): string {
  if (!email) {
    return "";
  }
  const lower = email.toLowerCase();
  if (lower.endsWith("@gmail.com")) {
    return email.slice(0, -"@gmail.com".length);
  }
  if (lower.endsWith("@googlemail.com")) {
    return email.slice(0, -"@googlemail.com".length);
  }
  return email;
}

