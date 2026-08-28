import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  API_DENY_TABLES,
  AUTH_DENY_TABLES,
  AUTH_FULL_TABLES,
  AUTH_INSERT_SELECT_TABLES,
} from "./migrate-roles.js";
import {
  account,
  jwksKey,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  oidcBackchannelLogoutDelivery,
  oidcRpSession,
  session,
  ssfDelivery,
  ssfStream,
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
      oauthApplication,
      oauthAccessToken,
      oauthConsent,
      oidcRpSession,
      oidcBackchannelLogoutDelivery,
      ssfStream,
      ssfDelivery,
    ]
      .map(getTableName)
      .sort();
    expect([...AUTH_FULL_TABLES].sort()).toEqual(configuredAuthTables);
  });

  it("keeps lifecycle side effects append-only and product tables denied", () => {
    expect(AUTH_INSERT_SELECT_TABLES).toEqual(["identity_lifecycle_outbox"]);
    expect(AUTH_DENY_TABLES).toEqual([
      "email_outbox",
      "email_suppression",
      "external_accounts",
      "bid_identity_directory",
      "bid_user_profile",
    ]);
  });

  it("statically denies api_app auth tables after the user-read cutover", () => {
    const denied = new Set<string>(API_DENY_TABLES);
    for (const table of AUTH_FULL_TABLES) {
      expect(denied.has(table), table).toBe(true);
    }
  });
});
