import {
  type EnvelopeCrypto,
  wrapAuthDatabaseAdapter,
  wrapOAuthConsentUpsertAdapter,
  wrapPasskeyLimitAdapter,
} from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { createDrizzleConsentStore } from "@auction/identity-db";
import {
  account,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  passkey,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
} from "@auction/identity-db/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function buildDrizzleDatabase(
  db: IdentityDatabase,
  envelope?: EnvelopeCrypto,
): ReturnType<typeof drizzleAdapter> {
  const consentStore = createDrizzleConsentStore(db);
  const inner = drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      oauthApplication,
      oauthAccessToken,
      oauthConsent,
      twoFactor: twoFactorTable,
      passkey,
    },
  });
  type DrizzleAdapterOptions = Parameters<typeof inner>[0];
  // The consent upsert and the passkey limit both wrap the same adapter: the first routes consent
  // inserts through one atomic store, the second names the database's ten-passkey refusal.
  const withConsentUpsert = ((options: DrizzleAdapterOptions) =>
    wrapPasskeyLimitAdapter(
      wrapOAuthConsentUpsertAdapter(inner(options) as never, consentStore) as never,
    )) as unknown as ReturnType<typeof drizzleAdapter>;
  if (!envelope) return withConsentUpsert;
  return ((options: DrizzleAdapterOptions) =>
    wrapAuthDatabaseAdapter(
      withConsentUpsert(options) as never,
      envelope,
    )) as unknown as ReturnType<typeof drizzleAdapter>;
}
