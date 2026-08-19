import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  API_DENY_TABLES,
  AUTH_EXTERNAL_ACCOUNT_TABLES,
  AUTH_FULL_TABLES,
  AUTH_INSERT_SELECT_TABLES,
  AUTH_PRODUCT_LINK_READ_TABLES,
  AUTH_SELECT_TABLES,
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
    expect(AUTH_EXTERNAL_ACCOUNT_TABLES).toEqual(["external_accounts"]);
    expect(AUTH_PRODUCT_LINK_READ_TABLES).toEqual(["bid_user_profile"]);
  });

  it("keeps lifecycle and email side-effect grants narrow", () => {
    expect(AUTH_INSERT_SELECT_TABLES).toEqual([
      "email_outbox",
      "domain_events",
      "identity_lifecycle_outbox",
    ]);
    expect(AUTH_SELECT_TABLES).toEqual(["email_suppression"]);
  });

  it("denies api_app every auth-owned table except the public subject projection", () => {
    const denied = new Set<string>(API_DENY_TABLES);
    for (const table of AUTH_FULL_TABLES) {
      expect(denied.has(table), table).toBe(table !== "user");
    }
  });
});
