import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  AUTH_FULL_TABLES,
  AUTH_INSERT_SELECT_TABLES,
  AUTH_SELECT_TABLES,
} from "./migrate-roles.js";
import {
  account,
  externalAccount,
  jwksKey,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  session,
  twoFactor,
  user,
  verification,
} from "./schema/index.js";

describe("Better Auth schema and auth_app grant drift", () => {
  it("grants full DML to every table configured for Better Auth and its plugins", () => {
    const configuredAuthTables = [
      user,
      session,
      account,
      verification,
      twoFactor,
      jwksKey,
      externalAccount,
      oauthApplication,
      oauthAccessToken,
      oauthConsent,
    ]
      .map(getTableName)
      .sort();
    expect([...AUTH_FULL_TABLES].sort()).toEqual(configuredAuthTables);
  });

  it("keeps lifecycle and email side-effect grants narrow", () => {
    expect(AUTH_INSERT_SELECT_TABLES).toEqual(["email_outbox", "domain_events"]);
    expect(AUTH_SELECT_TABLES).toEqual(["email_suppression"]);
  });
});
