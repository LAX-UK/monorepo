import {
  type NormalizedSsfSignal,
  SOCKET_REVOCATION_CHANNEL_V1,
  SSF_EVENT_TYPES,
  SSF_VERIFICATION_EVENT,
  type SocketRevocationPayloadV1,
  type SsfReplayStore,
  SsfVerificationError,
  verifyAndConsumeSet,
} from "@auction/identity-contracts";
import { Hono } from "hono";
import { StaleSsfSignalError } from "../services/interfaces/ssf-signal.js";

const BID_SSF_AUDIENCE = "lax-bid-api";

export function createBidSsfEventsRoute(input: {
  replayStore: SsfReplayStore;
  issuer: string;
  jwksUrl: string;
  publish: (channel: string, message: string) => Promise<unknown>;
}) {
  const app = new Hono();

  app.post("/", async (c) => {
    if (!(c.req.header("content-type") ?? "").includes("application/secevent+jwt")) {
      return c.json({ error: "invalid_request" }, 400);
    }
    try {
      const signal = await verifyAndConsumeSet({
        token: await c.req.text(),
        jwksUrl: input.jwksUrl,
        issuer: input.issuer,
        audience: BID_SSF_AUDIENCE,
        replayStore: input.replayStore,
        supportedEventTypes: [
          SSF_EVENT_TYPES.SESSION_REVOKED,
          SSF_EVENT_TYPES.CREDENTIAL_CHANGE,
          SSF_EVENT_TYPES.ACCOUNT_DISABLED,
          SSF_EVENT_TYPES.ACCOUNT_ENABLED,
          SSF_EVENT_TYPES.ACCOUNT_PURGED,
          SSF_EVENT_TYPES.IDENTIFIER_RECYCLED,
          SSF_EVENT_TYPES.LAX_IDENTITY_MERGED,
          SSF_VERIFICATION_EVENT,
        ],
      });
      const revocation = socketRevocationForSignal(signal);
      if (revocation) {
        await input.publish(SOCKET_REVOCATION_CHANNEL_V1, JSON.stringify(revocation));
      }
      return c.body(null, 202);
    } catch (error) {
      if (error instanceof StaleSsfSignalError) return c.body(null, 202);
      const code = error instanceof SsfVerificationError ? error.code : "invalid_set";
      return c.json({ error: code }, 400);
    }
  });

  return app;
}

export function socketRevocationForSignal(
  signal: NormalizedSsfSignal,
): SocketRevocationPayloadV1 | null {
  if (signal.eventType === SSF_EVENT_TYPES.SESSION_REVOKED) {
    // Identity maps this event's sessionId into SET sub_id.id. It is an RP
    // session identifier, not a user subject.
    return { version: 1, sid: signal.subjectId, reason: "session_revoked" };
  }
  const reason = (() => {
    switch (signal.eventType) {
      case SSF_EVENT_TYPES.CREDENTIAL_CHANGE:
        return "credential_change";
      case SSF_EVENT_TYPES.ACCOUNT_DISABLED:
      case SSF_EVENT_TYPES.ACCOUNT_PURGED:
        return "account_disabled";
      case SSF_EVENT_TYPES.IDENTIFIER_RECYCLED:
        return "identifier_recycled";
      case SSF_EVENT_TYPES.LAX_IDENTITY_MERGED:
        return "identity_merged";
      case SSF_EVENT_TYPES.ACCOUNT_ENABLED:
      case SSF_VERIFICATION_EVENT:
        return null;
    }
  })();
  return reason ? { version: 1, subject: signal.subjectId, reason } : null;
}
