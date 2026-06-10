const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_INVITE_BATCH = 50;

export function isValidInviteEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim().toLowerCase());
}

/** Merge new emails into an existing list (lowercase, deduped, capped). */
export function mergeInviteEmails(
  existing: readonly string[],
  incoming: readonly string[],
): {
  merged: string[];
  truncated: boolean;
} {
  const seen = new Set(existing.map((e) => e.toLowerCase()));
  const merged = [...existing];
  for (const raw of incoming) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (merged.length >= MAX_INVITE_BATCH) {
      return { merged, truncated: true };
    }
    seen.add(email);
    merged.push(email);
  }
  return { merged, truncated: false };
}

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
