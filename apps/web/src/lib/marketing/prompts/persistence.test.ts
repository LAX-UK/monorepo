import { describe, expect, it } from "vitest";
import {
  EMPTY_MARKETING_PROMPT_SESSION,
  MARKETING_PROMPT_CTA_TTL_MS,
  MARKETING_PROMPT_DISMISSAL_TTL_MS,
  marketingPromptSuppressionKey,
  readMarketingPromptSession,
  readMarketingPromptSuppression,
  writeMarketingPromptSession,
  writeMarketingPromptSuppression,
} from "./persistence";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("marketing prompt persistence", () => {
  it("expires dismissals after 14 days and CTA suppression after 90 days", () => {
    const storage = memoryStorage();
    const now = 1_000_000;

    writeMarketingPromptSuppression(storage, "selling", "dismissed", now);
    expect(
      readMarketingPromptSuppression(
        storage,
        "selling",
        now + MARKETING_PROMPT_DISMISSAL_TTL_MS - 1,
      ),
    ).not.toBeNull();
    expect(
      readMarketingPromptSuppression(storage, "selling", now + MARKETING_PROMPT_DISMISSAL_TTL_MS),
    ).toBeNull();

    writeMarketingPromptSuppression(storage, "selling", "cta", now);
    expect(
      readMarketingPromptSuppression(storage, "selling", now + MARKETING_PROMPT_CTA_TTL_MS - 1),
    ).not.toBeNull();
    expect(
      readMarketingPromptSuppression(storage, "selling", now + MARKETING_PROMPT_CTA_TTL_MS),
    ).toBeNull();
  });

  it("keeps variant suppression independent", () => {
    const storage = memoryStorage();
    writeMarketingPromptSuppression(storage, "selling", "dismissed", 100);

    expect(readMarketingPromptSuppression(storage, "selling", 101)).not.toBeNull();
    expect(readMarketingPromptSuppression(storage, "signup", 101)).toBeNull();
    expect(marketingPromptSuppressionKey("selling")).not.toBe(
      marketingPromptSuppressionKey("signup"),
    );
  });

  it("removes malformed values and returns a safe default", () => {
    const storage = memoryStorage();
    storage.setItem(marketingPromptSuppressionKey("signup"), "{malformed");

    expect(readMarketingPromptSuppression(storage, "signup")).toBeNull();
    expect(readMarketingPromptSession(storage)).toEqual(EMPTY_MARKETING_PROMPT_SESSION);
  });

  it("round-trips valid session state", () => {
    const storage = memoryStorage();
    const session = {
      activeDwellMs: 20_000,
      eligiblePageViews: 2,
      lastEligiblePath: "/search",
      shownVariant: "selling" as const,
      sellingIntentTrigger: "sell-content" as const,
    };

    writeMarketingPromptSession(storage, session);
    expect(readMarketingPromptSession(storage)).toEqual(session);
  });

  it("fails open safely when browser storage is unavailable", () => {
    const unavailable = {
      getItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readMarketingPromptSuppression(unavailable, "selling")).toBeNull();
    expect(readMarketingPromptSession(unavailable)).toEqual(EMPTY_MARKETING_PROMPT_SESSION);
    expect(() => writeMarketingPromptSuppression(unavailable, "signup", "dismissed")).not.toThrow();
    expect(() =>
      writeMarketingPromptSession(unavailable, EMPTY_MARKETING_PROMPT_SESSION),
    ).not.toThrow();
  });
});
