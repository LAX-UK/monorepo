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
