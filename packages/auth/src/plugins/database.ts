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
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { wrapAuthDatabaseAdapter } from "../adapter-at-rest.js";
import type { EnvelopeCrypto } from "../crypto/envelope.js";

export function buildDrizzleDatabase(db: Database, envelope?: EnvelopeCrypto) {
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
  if (!envelope) return inner;
  type DrizzleAdapterOptions = Parameters<typeof inner>[0];
  return ((options: DrizzleAdapterOptions) =>
    wrapAuthDatabaseAdapter(inner(options) as never, envelope)) as unknown as ReturnType<
    typeof drizzleAdapter
  >;
}
