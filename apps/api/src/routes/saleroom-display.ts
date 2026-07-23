import { displayPairPollBodySchema, displaySnapshotParamSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSaleroomDisplayRoutesSlice } from "../container.js";
import { respondBiddingRouteOutcome } from "../lib/bidding-route-response.js";
import { zValidator } from "../lib/z-validator.js";

function readDisplayToken(c: { req: { header: (name: string) => string | undefined } }):
  | string
  | null {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (token) return token;
  }
  return null;
}

function unauthorizedDisplayToken() {
  return { error: "Display token required", code: "unauthorized" } as const;
}

export function createSaleroomDisplayRoutes(container: ContainerSaleroomDisplayRoutesSlice) {
  const http = () => container.bidding.saleroomDisplayHttp;
  const r = new Hono();

  r.post("/display/pair/start", async (c) => {
    return respondBiddingRouteOutcome(c, await http().startPairing());
  });

  r.post("/display/pair/poll", zValidator("json", displayPairPollBodySchema), async (c) => {
    const { deviceCode } = c.req.valid("json");
    return respondBiddingRouteOutcome(c, await http().pollPairing(deviceCode));
  });

  r.get("/display/:saleId/verify", zValidator("param", displaySnapshotParamSchema), async (c) => {
    const { saleId } = c.req.valid("param");
    const token = readDisplayToken(c);
    if (!token) {
      return c.json(unauthorizedDisplayToken(), 401);
    }
    const outcome = await http().verifyDisplayTokenForSale({ displayToken: token, saleId });
    if (outcome.kind === "err") {
      return respondBiddingRouteOutcome(c, outcome);
    }
    return c.json({ data: outcome.data }, 200, { "Cache-Control": "no-store" });
  });

  r.get("/display/:saleId/snapshot", zValidator("param", displaySnapshotParamSchema), async (c) => {
    const { saleId } = c.req.valid("param");
    const token = readDisplayToken(c);
    if (!token) {
      return c.json(unauthorizedDisplayToken(), 401);
    }
    const outcome = await http().getSnapshot({ displayToken: token, saleId });
    if (outcome.kind === "not_found") {
      return c.json({ error: "Sale not found" }, 404);
    }
    if (outcome.kind === "err") {
      return respondBiddingRouteOutcome(c, outcome);
    }
    return c.json({ data: outcome.data }, 200, {
      "Cache-Control": "no-store",
    });
  });

  r.post("/display/heartbeat", async (c) => {
    const token = readDisplayToken(c);
    if (!token) {
      return c.json(unauthorizedDisplayToken(), 401);
    }
    return respondBiddingRouteOutcome(c, await http().heartbeat(token));
  });

  return r;
}
