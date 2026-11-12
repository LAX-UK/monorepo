import type { createAuth } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { DrizzleSessionCapStore } from "../infrastructure/drizzle-session-cap.store.js";
import { DrizzleSessionTakeoverStore } from "../infrastructure/drizzle-session-takeover.store.js";
import { DeviceMarkerHasher } from "../services/device-marker.js";
import type { DurableSecurityEffects } from "../services/durable-security-effects.js";
import type { SessionActivity } from "../services/session-activity.service.js";
import { SessionCap } from "../services/session-cap.service.js";
import {
  type EndedSessionNotifier,
  SessionTakeoverService,
} from "../services/session-takeover.service.js";
import { type SecurityEffectLogger, describeError } from "../services/settle-security-effect.js";
import { type DeviceSessionHook, createDeviceSessionHook } from "./device-session-hook.js";

const TAKEOVER_PATH = "session-takeover";
export const CAP_PATH = "session-cap";

/**
 * Another person's records that a new sign-in in the same browser ends: their products are signed
 * out by back-channel logout, and one `session_revoked` is announced for the record and for each
 * earlier id of it, so downstream receivers see every sign-in that ended. Written to the durable
 * outbox before the records are deleted.
 */
export function createEndedSessionNotifier(
  durable: Pick<DurableSecurityEffects, "reserve">,
  path: string = TAKEOVER_PATH,
): EndedSessionNotifier {
  return {
    reserve: ({ userId, sessionIds }) =>
      durable.reserve(path, [
        { kind: "revoke_identity_sessions", userId, sessionIds },
        ...sessionIds.map((sessionId) => ({
          kind: "publish_session_revoked" as const,
          userId,
          sessionId,
        })),
      ]),
  };
}

export function createDeviceSessions(options: {
  db: IdentityDatabase;
  auth: ReturnType<typeof createAuth>;
  durable: Pick<DurableSecurityEffects, "reserve">;
  activity: Pick<SessionActivity, "record">;
  secrets: { deviceMarker: string | undefined; issuer: string };
  log: SecurityEffectLogger;
}): DeviceSessionHook {
  return createDeviceSessionHook({
    takeover: new SessionTakeoverService(
      new DrizzleSessionTakeoverStore(options.db),
      createEndedSessionNotifier(options.durable),
      // A browser that loses its sign-in to the cap is announced like any other ended record.
      new SessionCap(
        new DrizzleSessionCapStore(options.db),
        createEndedSessionNotifier(options.durable, CAP_PATH),
      ),
      undefined,
      (error, userId) =>
        options.log.error({ userId, ...describeError(error) }, "session_cap_failed"),
    ),
    hasher: new DeviceMarkerHasher({
      secret: options.secrets.deviceMarker,
      fallbackSecret: options.secrets.issuer,
    }),
    // The cookie cache is skipped: takeover must see the record as it is in the database.
    readSession: async (headers) =>
      (await options.auth.api.getSession({ headers, query: { disableCookieCache: true } }))
        ?.session ?? null,
    readCachedSession: async (headers) =>
      (await options.auth.api.getSession({ headers }))?.session ?? null,
    activity: options.activity,
    log: options.log,
  });
}
