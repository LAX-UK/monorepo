export type StripeConnectAccountStaffLabel = {
  primary: string;
  secondary?: string;
  rawId: string;
  environment: "demo" | "live";
};

const SEED_PREFIX = "acct_seed_";

const SEED_STATE_SUFFIXES: Record<string, string> = {
  ready: "Ready for payouts",
  needs_info: "Verification details needed",
  rejected: "Account rejected",
};

function titleCaseToken(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function titleCaseSlug(slug: string): string {
  return slug.split("_").filter(Boolean).map(titleCaseToken).join(" ");
}

function parseSeedAccountId(accountId: string): StripeConnectAccountStaffLabel {
  const body = accountId.slice(SEED_PREFIX.length);

  for (const [suffix, secondary] of Object.entries(SEED_STATE_SUFFIXES)) {
    const marker = `_${suffix}`;
    if (body.endsWith(marker)) {
      const nameSlug = body.slice(0, -marker.length);
      return {
        primary: `Demo Connect account · ${titleCaseSlug(nameSlug)}`,
        secondary,
        rawId: accountId,
        environment: "demo",
      };
    }
  }

  return {
    primary: `Demo Connect account · ${titleCaseSlug(body)}`,
    rawId: accountId,
    environment: "demo",
  };
}

function maskLiveAccountId(accountId: string): string {
  if (accountId.length <= 4) return accountId;
  return `····${accountId.slice(-4)}`;
}

/** Staff-facing label for a Stripe Connect account id (demo seed or live). */
export function formatStripeConnectAccountForStaff(
  accountId: string,
): StripeConnectAccountStaffLabel {
  const trimmed = accountId.trim();
  if (trimmed.startsWith(SEED_PREFIX)) {
    return parseSeedAccountId(trimmed);
  }

  return {
    primary: "Stripe Connect account",
    secondary: maskLiveAccountId(trimmed),
    rawId: trimmed,
    environment: "live",
  };
}
