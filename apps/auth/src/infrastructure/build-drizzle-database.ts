import {
  type EnvelopeCrypto,
  wrapAuthDatabaseAdapter,
  wrapOAuthConsentUpsertAdapter,
} from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { createDrizzleConsentStore } from "@auction/identity-db";
import {
  account,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
} from "@auction/identity-db/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function buildDrizzleDatabase(db: IdentityDatabase, envelope?: EnvelopeCrypto) {
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
    },
  });
  type DrizzleAdapterOptions = Parameters<typeof inner>[0];
  const withConsentUpsert = ((options: DrizzleAdapterOptions) =>
    wrapOAuthConsentUpsertAdapter(inner(options) as never, consentStore)) as unknown as ReturnType<
    typeof drizzleAdapter
  >;
  if (!envelope) return withConsentUpsert;
  return ((options: DrizzleAdapterOptions) =>
    wrapAuthDatabaseAdapter(
      withConsentUpsert(options) as never,
      envelope,
    )) as unknown as ReturnType<typeof drizzleAdapter>;
}
