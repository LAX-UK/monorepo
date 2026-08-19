import {
  type EnvelopeCrypto,
  wrapAuthDatabaseAdapter,
  wrapOAuthConsentUpsertAdapter,
} from "@auction/auth";
import type { Database } from "@auction/db";
import {
  account,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
} from "@auction/db/schema";
import { createDrizzleConsentStore } from "@auction/identity-db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function buildDrizzleDatabase(db: Database, envelope?: EnvelopeCrypto) {
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
