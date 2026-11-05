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
