import { Hono } from "hono";
import { cors } from "hono/cors";
import { describe, expect, it } from "vitest";
import { BROWSER_CORS_ALLOW_HEADERS } from "./app.js";
import { X_LEGAL_ENTITY_ID_HEADER } from "./middleware/require-legal-entity-context.js";

const TEST_ORIGIN = "https://test.lax.bid";

describe("browser CORS", () => {
  it("allowlist includes acting legal entity header", () => {
    expect(BROWSER_CORS_ALLOW_HEADERS).toContain(X_LEGAL_ENTITY_ID_HEADER);
  });

  it("OPTIONS /bids preflight allows x-legal-entity-id", async () => {
    const app = new Hono();
    app.use(
      "*",
      cors({
        origin: TEST_ORIGIN,
        allowHeaders: [...BROWSER_CORS_ALLOW_HEADERS],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
      }),
    );
    app.post("/bids", (c) => c.json({ ok: true }, 201));

    const res = await app.request("/bids", {
      method: "OPTIONS",
      headers: {
        Origin: TEST_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": `content-type,idempotency-key,${X_LEGAL_ENTITY_ID_HEADER}`,
      },
    });

    expect(res.status).toBe(204);
    const allowed = res.headers.get("access-control-allow-headers") ?? "";
    expect(allowed.toLowerCase()).toContain(X_LEGAL_ENTITY_ID_HEADER);
    expect(res.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
  });
});
