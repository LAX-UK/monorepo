const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split pasted invite emails (comma, semicolon, space, or newline separated). */
export function parseInviteEmailList(raw: string): string[] {
  const parts = raw
    .split(/[,;\s\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)];
}

export function partitionInviteEmails(raw: string): {
  valid: string[];
  invalid: string[];
} {
  const emails = parseInviteEmailList(raw);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const email of emails) {
    if (EMAIL_RE.test(email)) valid.push(email);
    else invalid.push(email);
  }
  return { valid, invalid };
}
