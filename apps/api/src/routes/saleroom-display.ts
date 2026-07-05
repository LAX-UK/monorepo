import { displayPairPollBodySchema, displaySnapshotParamSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerSaleroomDisplayRoutesSlice } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
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

export function createSaleroomDisplayRoutes(container: ContainerSaleroomDisplayRoutesSlice) {
  const r = new Hono();

  r.post("/display/pair/start", async (c) => {
    const data = await container.displayPairingService.startPairing();
    return c.json({ data });
  });

  r.post("/display/pair/poll", zValidator("json", displayPairPollBodySchema), async (c) => {
    const { deviceCode } = c.req.valid("json");
    const result = await container.displayPairingService.pollPairing(deviceCode);
    return c.json({ data: result });
  });

  r.get("/display/:saleId/verify", zValidator("param", displaySnapshotParamSchema), async (c) => {
    const { saleId } = c.req.valid("param");
    const token = readDisplayToken(c);
    if (!token) {
      return c.json({ error: "Display token required", code: "unauthorized" }, 401);
    }
    const verified = await container.displayPairingService.verifyDisplayTokenForSale(token, saleId);
    if (verified.isErr()) {
      return c.json(
        {
          error: verified.error.message,
          ...(verified.error.code ? { code: verified.error.code } : {}),
        },
        asHttpStatus(verified.error.status),
      );
    }
    return c.json({ data: { ok: true } }, 200, { "Cache-Control": "no-store" });
  });

  r.get("/display/:saleId/snapshot", zValidator("param", displaySnapshotParamSchema), async (c) => {
    const { saleId } = c.req.valid("param");
    const token = readDisplayToken(c);
    if (!token) {
      return c.json({ error: "Display token required", code: "unauthorized" }, 401);
    }
    const verified = await container.displayPairingService.verifyDisplayTokenForSale(token, saleId);
    if (verified.isErr()) {
      return c.json(
        {
          error: verified.error.message,
          ...(verified.error.code ? { code: verified.error.code } : {}),
        },
        asHttpStatus(verified.error.status),
      );
    }
    const snapshot = await container.displaySnapshotReader.getSnapshot(saleId);
    if (!snapshot) {
      return c.json({ error: "Sale not found" }, 404);
    }
    return c.json({ data: snapshot }, 200, {
      "Cache-Control": "no-store",
    });
  });

  r.post("/display/heartbeat", async (c) => {
    const token = readDisplayToken(c);
    if (!token) {
      return c.json({ error: "Display token required", code: "unauthorized" }, 401);
    }
    const result = await container.displayPairingService.heartbeat(token);
    return result.match(
      (body) => c.json({ data: body }),
      (e) =>
        c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
    );
  });

  return r;
}
