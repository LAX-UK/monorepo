import {
  MARKETING_PROMPT_VARIANTS,
  type MarketingPromptSession,
  type MarketingPromptSuppression,
  type MarketingPromptSuppressionReason,
  type MarketingPromptVariant,
} from "./types";

export const MARKETING_PROMPT_DISMISSAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const MARKETING_PROMPT_CTA_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const MARKETING_PROMPT_SESSION_KEY = "lax_marketing_prompt_session_v1";
const SUPPRESSION_KEY_PREFIX = "lax_marketing_prompt_suppression_v1";

export const EMPTY_MARKETING_PROMPT_SESSION: MarketingPromptSession = {
  activeDwellMs: 0,
  eligiblePageViews: 0,
  lastEligiblePath: null,
  shownVariant: null,
  sellingIntentTrigger: null,
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function marketingPromptSuppressionKey(variant: MarketingPromptVariant): string {
  return `${SUPPRESSION_KEY_PREFIX}:${variant}`;
}

function isVariant(value: unknown): value is MarketingPromptVariant {
  return MARKETING_PROMPT_VARIANTS.includes(value as MarketingPromptVariant);
}

function isSuppression(value: unknown): value is MarketingPromptSuppression {
  if (!value || typeof value !== "object") return false;
  const suppression = value as Partial<MarketingPromptSuppression>;
  return (
    (suppression.reason === "dismissed" || suppression.reason === "cta") &&
    typeof suppression.recordedAt === "number" &&
    Number.isFinite(suppression.recordedAt)
  );
}

function suppressionTtl(reason: MarketingPromptSuppressionReason): number {
  return reason === "cta" ? MARKETING_PROMPT_CTA_TTL_MS : MARKETING_PROMPT_DISMISSAL_TTL_MS;
}

export function readMarketingPromptSuppression(
  storage: StorageLike,
  variant: MarketingPromptVariant,
  now = Date.now(),
): MarketingPromptSuppression | null {
  const key = marketingPromptSuppressionKey(variant);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const suppression: unknown = JSON.parse(raw);
    if (!isSuppression(suppression)) {
      storage.removeItem(key);
      return null;
    }
    if (now - suppression.recordedAt >= suppressionTtl(suppression.reason)) {
      storage.removeItem(key);
      return null;
    }
    return suppression;
  } catch {
    return null;
  }
}

export function writeMarketingPromptSuppression(
  storage: StorageLike,
  variant: MarketingPromptVariant,
  reason: MarketingPromptSuppressionReason,
  now = Date.now(),
): void {
  try {
    storage.setItem(
      marketingPromptSuppressionKey(variant),
      JSON.stringify({ reason, recordedAt: now } satisfies MarketingPromptSuppression),
    );
  } catch {
    // Storage may be disabled or full; prompts still remain dismissible in memory.
  }
}

export function readMarketingPromptSession(storage: StorageLike): MarketingPromptSession {
  try {
    const raw = storage.getItem(MARKETING_PROMPT_SESSION_KEY);
    if (!raw) return { ...EMPTY_MARKETING_PROMPT_SESSION };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") throw new Error("Invalid session value");
    const session = value as Partial<MarketingPromptSession>;
    if (
      typeof session.activeDwellMs !== "number" ||
      !Number.isFinite(session.activeDwellMs) ||
      session.activeDwellMs < 0 ||
      typeof session.eligiblePageViews !== "number" ||
      !Number.isFinite(session.eligiblePageViews) ||
      session.eligiblePageViews < 0 ||
      (session.lastEligiblePath !== null && typeof session.lastEligiblePath !== "string") ||
      (session.shownVariant !== null && !isVariant(session.shownVariant)) ||
      (session.sellingIntentTrigger !== null &&
        session.sellingIntentTrigger !== "sell-content" &&
        session.sellingIntentTrigger !== "sell-query")
    ) {
      throw new Error("Invalid session shape");
    }
    return session as MarketingPromptSession;
  } catch {
    try {
      storage.removeItem(MARKETING_PROMPT_SESSION_KEY);
    } catch {
      // Ignore unavailable storage.
    }
    return { ...EMPTY_MARKETING_PROMPT_SESSION };
  }
}

export function writeMarketingPromptSession(
  storage: StorageLike,
  session: MarketingPromptSession,
): void {
  try {
    storage.setItem(MARKETING_PROMPT_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session state is also retained in memory by the orchestrator.
  }
}
