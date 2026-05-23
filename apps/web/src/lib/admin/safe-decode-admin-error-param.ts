const MAX_ADMIN_ERROR_LENGTH = 500;

function stripControlChars(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    const isControl =
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    if (!isControl) out += char;
  }
  return out;
}

/** Safely decode `?error=` query values for admin list alerts (malformed URI, length, control chars). */
export function safeDecodeAdminErrorParam(
  value: string | string[] | undefined | null,
): string | null {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || raw.trim() === "") return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  const cleaned = stripControlChars(decoded).trim();
  if (!cleaned) return null;
  if (cleaned.length <= MAX_ADMIN_ERROR_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_ADMIN_ERROR_LENGTH)}…`;
}
