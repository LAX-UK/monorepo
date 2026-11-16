import { DEV_ALERT_LINK_SECRET } from "@auction/alerts";
import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";

function alertSecretIssues(env: Record<string, unknown>): string[] {
  const result = envSchema.safeParse({ DATABASE_URL: "postgres://localhost/test", ...env });
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path[0] === "ALERT_LINK_SECRET")
    .map((issue) => issue.message);
}

describe("worker ALERT_LINK_SECRET in production", () => {
  it("refuses the development default, whatever the send mode", () => {
    for (const ALERTS_SEND_MODE of ["off", "dry_run", "on"]) {
      expect(alertSecretIssues({ APP_ENV: "production", ALERTS_SEND_MODE })).not.toHaveLength(0);
    }
  });

  it("refuses a short secret", () => {
    expect(
      alertSecretIssues({ APP_ENV: "production", ALERT_LINK_SECRET: "short-secret-1234" }),
    ).not.toHaveLength(0);
  });

  it("accepts a real secret", () => {
    expect(alertSecretIssues({ APP_ENV: "production", ALERT_LINK_SECRET: "k".repeat(40) })).toEqual(
      [],
    );
  });

  it("accepts the development default outside production", () => {
    expect(
      alertSecretIssues({ APP_ENV: "test", ALERT_LINK_SECRET: DEV_ALERT_LINK_SECRET }),
    ).toEqual([]);
  });
});

describe("worker ALERT_RETENTION_PURGE_ENABLED", () => {
  const parse = (extra: Record<string, unknown>) => {
    const result = envSchema.safeParse({ DATABASE_URL: "postgres://localhost/test", ...extra });
    // Other settings may fail in a bare environment; only this flag is read here.
    return result.success ? result.data.ALERT_RETENTION_PURGE_ENABLED : null;
  };

  it("is off unless it is switched on, so the prune only logs", () => {
    const off = envSchema.safeParse({ DATABASE_URL: "postgres://localhost/test" });
    expect(off.success && off.data.ALERT_RETENTION_PURGE_ENABLED).toBe(false);
    expect(parse({ ALERT_RETENTION_PURGE_ENABLED: "" })).toBe(false);
    expect(parse({ ALERT_RETENTION_PURGE_ENABLED: "false" })).toBe(false);
  });

  it("is read like KYC_RETENTION_PURGE_ENABLED", () => {
    for (const value of ["true", "1", "yes", "on"]) {
      expect(parse({ ALERT_RETENTION_PURGE_ENABLED: value }), value).toBe(true);
    }
  });
});

describe("worker PRIVATE_SALE_RECORD_RETENTION_YEARS", () => {
  const years = (value: unknown) =>
    envSchema.safeParse({
      DATABASE_URL: "postgres://localhost/test",
      PRIVATE_SALE_RECORD_RETENTION_YEARS: value,
    });

  it("refuses less than the five years the money laundering rules require", () => {
    expect(years("4").success).toBe(false);
  });

  it("accepts five or more, and defaults to five", () => {
    expect(years("5").success).toBe(true);
    const parsed = years("");
    expect(parsed.success && parsed.data.PRIVATE_SALE_RECORD_RETENTION_YEARS).toBe(5);
  });
});

describe("worker COLLECTION_HANDOVER_RETENTION_YEARS", () => {
  const years = (value: unknown) =>
    envSchema.safeParse({
      DATABASE_URL: "postgres://localhost/test",
      COLLECTION_HANDOVER_RETENTION_YEARS: value,
    });

  it("refuses less than three years", () => {
    for (const value of ["0", "1", "2"]) expect(years(value).success, value).toBe(false);
  });

  it("accepts three or more, and defaults to six", () => {
    expect(years("3").success).toBe(true);
    const parsed = years("");
    expect(parsed.success && parsed.data.COLLECTION_HANDOVER_RETENTION_YEARS).toBe(6);
  });
});

describe("worker collection calendar organizer", () => {
  const parse = (extra: Record<string, unknown> = {}) =>
    envSchema.safeParse({ DATABASE_URL: "postgres://localhost/test", ...extra });

  it("defaults to LAX Bid's own name and a Bid address, so nothing has to be set", () => {
    const parsed = parse();
    expect(parsed.success && parsed.data.COLLECTION_ORGANIZER_NAME).toBe("LAX Bid");
    expect(parsed.success && parsed.data.COLLECTION_ORGANIZER_EMAIL).toBe("collections@lax.bid");
  });

  it("treats a blank value as unset, and refuses an address that is not one", () => {
    const blank = parse({ COLLECTION_ORGANIZER_EMAIL: "", COLLECTION_ORGANIZER_NAME: "" });
    expect(blank.success && blank.data.COLLECTION_ORGANIZER_NAME).toBe("LAX Bid");
    expect(parse({ COLLECTION_ORGANIZER_EMAIL: "not-an-address" }).success).toBe(false);
  });
});

describe("worker COLLECTION_CAN_BOOK_EMAILS_FROM", () => {
  const parse = (value?: unknown) =>
    envSchema.safeParse({
      DATABASE_URL: "postgres://localhost/test",
      ...(value === undefined ? {} : { COLLECTION_CAN_BOOK_EMAILS_FROM: value }),
    });

  it("parses an ISO date or date-time", () => {
    const parsed = parse("2026-12-01");
    expect(parsed.success && parsed.data.COLLECTION_CAN_BOOK_EMAILS_FROM.toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });

  it("falls back to the fixed default when missing or blank", () => {
    for (const value of [undefined, ""]) {
      const parsed = parse(value);
      expect(parsed.success && parsed.data.COLLECTION_CAN_BOOK_EMAILS_FROM.toISOString()).toBe(
        "2026-11-16T00:00:00.000Z",
      );
    }
  });

  it("refuses a value that is not a date", () => {
    expect(parse("next tuesday").success).toBe(false);
  });
});

describe("worker XERO_TOKEN_DEK_KEY", () => {
  const issues = (env: Record<string, unknown>) => {
    const result = envSchema.safeParse({ DATABASE_URL: "postgres://localhost/test", ...env });
    return result.success
      ? []
      : result.error.issues.filter((i) => i.path[0] === "XERO_TOKEN_DEK_KEY");
  };

  it("is required once Xero is configured, and must be a 32-byte key", () => {
    expect(issues({ XERO_CLIENT_ID: "id" })).not.toHaveLength(0);
    expect(issues({ XERO_CLIENT_ID: "id", XERO_TOKEN_DEK_KEY: "short" })).not.toHaveLength(0);
    expect(issues({ XERO_CLIENT_ID: "id", XERO_TOKEN_DEK_KEY: "ab".repeat(32) })).toEqual([]);
  });

  it("is not needed when Xero is not configured", () => {
    expect(issues({})).toEqual([]);
  });
});

describe("worker on a test stack", () => {
  // Built from parts so no complete key-shaped string sits in the source.
  const liveKey = (prefix: string) => `${prefix}_live_${"x".repeat(16)}`;
  const issuesFor = (path: string, env: Record<string, unknown>): string[] => {
    const result = envSchema.safeParse({ DATABASE_URL: "postgres://localhost/test", ...env });
    if (result.success) return [];
    return result.error.issues
      .filter((issue) => issue.path[0] === path)
      .map((issue) => issue.message);
  };

  it("refuses a live Stripe secret key when APP_ENV=test", () => {
    expect(
      issuesFor("STRIPE_SECRET_KEY", { APP_ENV: "test", STRIPE_SECRET_KEY: liveKey("sk") }),
    ).toEqual([
      "STRIPE_SECRET_KEY must use a test key (sk_test_… or rk_test_…) unless APP_ENV=production",
    ]);
  });

  it("refuses live Stripe keys when APP_ENV is unset (it defaults to development)", () => {
    expect(issuesFor("STRIPE_SECRET_KEY", { STRIPE_SECRET_KEY: liveKey("sk") })).toHaveLength(1);
    expect(
      issuesFor("STRIPE_BOOKS_READ_KEYS", { STRIPE_BOOKS_READ_KEYS: liveKey("rk") }),
    ).toHaveLength(1);
  });

  it("refuses an APP_ENV that is set but not production, test or development", () => {
    expect(issuesFor("APP_ENV", { APP_ENV: "Test" })).toHaveLength(1);
    expect(issuesFor("APP_ENV", { APP_ENV: "staging" })).toHaveLength(1);
  });

  it("refuses live Stripe read keys when APP_ENV=test", () => {
    expect(
      issuesFor("STRIPE_BOOKS_READ_KEYS", {
        APP_ENV: "test",
        STRIPE_BOOKS_READ_KEYS: `rk_test_abc,${liveKey("rk")}`,
      }),
    ).toHaveLength(1);
  });

  it("accepts Stripe test keys on test and leaves production keys to production", () => {
    expect(
      issuesFor("STRIPE_SECRET_KEY", { APP_ENV: "test", STRIPE_SECRET_KEY: "sk_test_abc" }),
    ).toEqual([]);
    expect(
      issuesFor("STRIPE_SECRET_KEY", { APP_ENV: "production", STRIPE_SECRET_KEY: liveKey("sk") }),
    ).toEqual([]);
  });

  it("requires a Zoho CRM sandbox org when a Zoho mode is live on test", () => {
    const live = { APP_ENV: "test", ZOHO_ARTWORK_SYNC_MODE: "live" };
    expect(issuesFor("ZOHO_CRM_EXPECTED_ORG_TYPE", live)).toHaveLength(1);
    expect(
      issuesFor("ZOHO_CRM_EXPECTED_ORG_TYPE", {
        ...live,
        ZOHO_CRM_EXPECTED_ORG_TYPE: "production",
      }),
    ).toHaveLength(1);
    expect(
      issuesFor("ZOHO_CRM_EXPECTED_ORG_TYPE", { ...live, ZOHO_CRM_EXPECTED_ORG_TYPE: "sandbox" }),
    ).toEqual([]);
    expect(
      issuesFor("ZOHO_CRM_EXPECTED_ORG_TYPE", { APP_ENV: "test", ZOHO_CRM_SYNC_MODE: "dry_run" }),
    ).toEqual([]);
  });

  it("requires a Zoho CRM sandbox org when APP_ENV is unset and a Zoho mode is live", () => {
    expect(
      issuesFor("ZOHO_CRM_EXPECTED_ORG_TYPE", { ZOHO_ARTWORK_SYNC_MODE: "live" }),
    ).toHaveLength(1);
    expect(issuesFor("ZOHO_CRM_EXPECTED_ORG_TYPE", { ZOHO_CRM_SYNC_MODE: "canary" })).toHaveLength(
      1,
    );
    expect(
      issuesFor("ZOHO_CRM_EXPECTED_ORG_TYPE", {
        APP_ENV: "production",
        ZOHO_CRM_SYNC_MODE: "live",
        ZOHO_CRM_EXPECTED_ORG_TYPE: "production",
      }),
    ).toEqual([]);
  });
});
