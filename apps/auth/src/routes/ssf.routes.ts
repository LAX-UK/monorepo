import {
  SSF_PUSH_DELIVERY_METHOD,
  SSF_RECEIVER_REGISTRY,
  type SsfReceiverClientId,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import type { SsfStreamService } from "../services/ssf-stream.service.js";
import type { SsfStreamStatus } from "../services/ssf.service.js";
import { authenticateConfidentialClient } from "./oauth-client-auth.js";
import type { ConfidentialClientAuthenticator } from "./token-exchange.routes.js";

export function createSsfRoutes(deps: {
  clients: ConfidentialClientAuthenticator;
  service: SsfStreamService;
}) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });

  app.post("/stream", async (c) => {
    const clientId = await authenticateReceiver(c, deps.clients);
    if (!clientId) return unauthorized(c);
    const body = await readObject(c);
    const delivery = isRecord(body?.delivery) ? body.delivery : null;
    const endpoint = delivery?.endpoint_url;
    const eventsRequested = body?.events_requested;
    if (
      delivery?.method !== SSF_PUSH_DELIVERY_METHOD ||
      typeof endpoint !== "string" ||
      !Array.isArray(eventsRequested) ||
      !eventsRequested.every((event) => typeof event === "string")
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    try {
      const stream = await deps.service.create(clientId, {
        endpoint,
        eventsRequested,
      });
      return c.json(stream, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid_request";
      if (message.includes("unique") || message.includes("duplicate")) {
        return c.json({ error: "conflict" }, 409);
      }
      return c.json({ error: message }, 400);
    }
  });

  app.get("/stream", async (c) => {
    const clientId = await authenticateReceiver(c, deps.clients);
    if (!clientId) return unauthorized(c);
    const streamId = c.req.query("stream_id");
    const streams = await deps.service.read(clientId, streamId);
    if (streamId && streams.length === 0) return c.json({ error: "not_found" }, 404);
    return c.json(streamId ? streams[0] : streams);
  });

  app.patch("/stream", async (c) => {
    const clientId = await authenticateReceiver(c, deps.clients);
    if (!clientId) return unauthorized(c);
    const body = await readObject(c);
    if (!body || typeof body.stream_id !== "string") {
      return c.json({ error: "invalid_request" }, 400);
    }
    const streamId = body.stream_id;
    const delivery = body.delivery === undefined ? undefined : body.delivery;
    if (
      delivery !== undefined &&
      (!isRecord(delivery) ||
        delivery.method !== SSF_PUSH_DELIVERY_METHOD ||
        typeof delivery.endpoint_url !== "string")
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const requested = body.events_requested;
    if (
      requested !== undefined &&
      (!Array.isArray(requested) || !requested.every((event) => typeof event === "string"))
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    try {
      const stream = await deps.service.update(clientId, streamId, {
        ...(isRecord(delivery) ? { endpoint: String(delivery.endpoint_url) } : {}),
        ...(Array.isArray(requested) ? { eventsRequested: requested } : {}),
      });
      return stream ? c.json(stream) : c.json({ error: "not_found" }, 404);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "invalid_request" }, 400);
    }
  });

  app.delete("/stream", async (c) => {
    const clientId = await authenticateReceiver(c, deps.clients);
    if (!clientId) return unauthorized(c);
    const streamId = c.req.query("stream_id");
    if (!streamId) return c.json({ error: "invalid_request" }, 400);
    return (await deps.service.delete(clientId, streamId))
      ? c.body(null, 204)
      : c.json({ error: "not_found" }, 404);
  });

  app.get("/status", async (c) => {
    const clientId = await authenticateReceiver(c, deps.clients);
    if (!clientId) return unauthorized(c);
    const streamId = c.req.query("stream_id");
    if (!streamId) return c.json({ error: "invalid_request" }, 400);
    const streams = await deps.service.read(clientId, streamId);
    const stream = streams[0];
    return stream
      ? c.json({ stream_id: stream.stream_id, status: stream.status })
      : c.json({ error: "not_found" }, 404);
  });

  app.post("/status", async (c) => {
    const clientId = await authenticateReceiver(c, deps.clients);
    if (!clientId) return unauthorized(c);
    const body = await readObject(c);
    if (
      typeof body?.stream_id !== "string" ||
      !["enabled", "paused", "disabled"].includes(String(body.status))
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const status = body.status as SsfStreamStatus;
    return (await deps.service.setStatus(clientId, body.stream_id, status))
      ? c.json({ stream_id: body.stream_id, status })
      : c.json({ error: "not_found" }, 404);
  });

  app.post("/verification", async (c) => {
    const clientId = await authenticateReceiver(c, deps.clients);
    if (!clientId) return unauthorized(c);
    const body = await readObject(c);
    if (
      typeof body?.stream_id !== "string" ||
      (body.state !== undefined && typeof body.state !== "string")
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }
    return (await deps.service.enqueueVerification(clientId, body.stream_id, body.state))
      ? c.body(null, 204)
      : c.json({ error: "not_found" }, 404);
  });

  return app;
}

async function authenticateReceiver(
  c: Context,
  clients: ConfidentialClientAuthenticator,
): Promise<SsfReceiverClientId | null> {
  const clientId = await authenticateConfidentialClient(
    clients,
    c.req.header("authorization"),
    new URLSearchParams(),
  );
  return clientId && clientId in SSF_RECEIVER_REGISTRY ? (clientId as SsfReceiverClientId) : null;
}

function unauthorized(c: Context) {
  c.header("WWW-Authenticate", 'Basic realm="ssf"');
  return c.json({ error: "invalid_client" }, 401);
}

async function readObject(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await c.req.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
