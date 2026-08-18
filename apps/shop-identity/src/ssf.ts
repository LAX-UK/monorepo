import {
  SSF_EVENT_TYPES,
  SSF_VERIFICATION_EVENT,
  type SsfReplayStore,
  SsfVerificationError,
  verifyAndConsumeSet,
} from "@auction/identity-contracts";
import { Hono } from "hono";

const SHOP_SSF_AUDIENCE = "lax-shop-api";

export function createShopSsfEventsRoute(input: {
  replayStore: SsfReplayStore;
  issuer: string;
  jwksUrl: string;
}) {
  const app = new Hono();

  app.post("/", async (c) => {
    if (!(c.req.header("content-type") ?? "").includes("application/secevent+jwt")) {
      return c.json({ error: "invalid_request" }, 400);
    }
    try {
      await verifyAndConsumeSet({
        token: await c.req.text(),
        jwksUrl: input.jwksUrl,
        issuer: input.issuer,
        audience: SHOP_SSF_AUDIENCE,
        replayStore: input.replayStore,
        supportedEventTypes: [
          SSF_EVENT_TYPES.SESSION_REVOKED,
          SSF_EVENT_TYPES.CREDENTIAL_CHANGE,
          SSF_EVENT_TYPES.ACCOUNT_DISABLED,
          SSF_EVENT_TYPES.ACCOUNT_ENABLED,
          SSF_EVENT_TYPES.ACCOUNT_PURGED,
          SSF_EVENT_TYPES.LAX_IDENTITY_MERGED,
          SSF_VERIFICATION_EVENT,
        ],
      });
      return c.body(null, 202);
    } catch (error) {
      const code = error instanceof SsfVerificationError ? error.code : "invalid_set";
      return c.json({ error: code }, 400);
    }
  });

  return app;
}
