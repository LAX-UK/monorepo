import {
  type EnvelopeCrypto,
  type IdentityEventPublisher,
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
import { wrapPasskeyAddedAdapter } from "./passkey-added-adapter.js";

export function buildDrizzleDatabase(
  db: IdentityDatabase,
  envelope?: EnvelopeCrypto,
  /** Where a new passkey's "added" event is stored, in the passkey's own transaction. */
  events?: IdentityEventPublisher,
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
  // Each wrapper changes one model's inserts: consent goes through one atomic store, a passkey is
  // stored with its "added" event in one transaction, and the database's ten-passkey refusal is named.
  const withConsentUpsert = ((options: DrizzleAdapterOptions) => {
    const consent = wrapOAuthConsentUpsertAdapter(inner(options) as never, consentStore) as never;
    const stored = events ? wrapPasskeyAddedAdapter(consent, { db, events }) : consent;
    return wrapPasskeyLimitAdapter(stored as never);
  }) as unknown as ReturnType<typeof drizzleAdapter>;
  if (!envelope) return withConsentUpsert;
  return ((options: DrizzleAdapterOptions) =>
    wrapAuthDatabaseAdapter(
      withConsentUpsert(options) as never,
      envelope,
    )) as unknown as ReturnType<typeof drizzleAdapter>;
}
