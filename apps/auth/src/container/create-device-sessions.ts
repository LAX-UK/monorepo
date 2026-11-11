import type { createAuth } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleSessionTakeoverStore } from "../infrastructure/drizzle-session-takeover.store.js";
import { DeviceMarkerHasher } from "../services/device-marker.js";
import type { DurableSecurityEffects } from "../services/durable-security-effects.js";
import {
  type EndedSessionNotifier,
  SessionTakeoverService,
} from "../services/session-takeover.service.js";
import type { SecurityEffectLogger } from "../services/settle-security-effect.js";
import { type DeviceSessionHook, createDeviceSessionHook } from "./device-session-hook.js";

const TAKEOVER_PATH = "session-takeover";

/**
 * Another person's records that a new sign-in in the same browser ended: their products are
 * signed out by back-channel logout, retried from the durable outbox if it fails.
 */
export function createEndedSessionNotifier(
  durable: Pick<DurableSecurityEffects, "settle">,
): EndedSessionNotifier {
  return {
    async ended({ userId, sessionIds }) {
      await Promise.all([
        durable.settle(TAKEOVER_PATH, { kind: "revoke_identity_sessions", userId, sessionIds }),
        durable.settle(TAKEOVER_PATH, { kind: "publish_session_revoked", userId }),
      ]);
    },
  };
}

export function createDeviceSessions(options: {
  db: IdentityDatabase;
  auth: ReturnType<typeof createAuth>;
  durable: Pick<DurableSecurityEffects, "settle">;
  secrets: { deviceMarker: string | undefined; issuer: string };
  log: SecurityEffectLogger;
}): DeviceSessionHook {
  return createDeviceSessionHook({
    takeover: new SessionTakeoverService(
      new DrizzleSessionTakeoverStore(options.db),
      createEndedSessionNotifier(options.durable),
    ),
    hasher: new DeviceMarkerHasher({
      secret: options.secrets.deviceMarker,
      fallbackSecret: options.secrets.issuer,
    }),
    // The cookie cache is skipped: takeover must see the record as it is in the database.
    readSession: async (headers) =>
      (await options.auth.api.getSession({ headers, query: { disableCookieCache: true } }))
        ?.session ?? null,
    log: options.log,
  });
}
