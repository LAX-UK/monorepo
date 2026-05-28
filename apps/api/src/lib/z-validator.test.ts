import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zValidator } from "./z-validator.js";

describe("zValidator", () => {
  it("returns a string error body on validation failure", async () => {
    const app = new Hono();
    app.post("/test", zValidator("json", z.object({ country: z.string().min(1) })), (c) =>
      c.json({ ok: true }),
    );

    const res = await app.request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: "" }),
    });

    const body = (await res.json()) as { error?: unknown; errorCode?: string };
    expect(res.status).toBe(400);
    expect(body).toEqual({
      error: expect.any(String),
      errorCode: "validation_failed",
    });
    expect(typeof body.error).toBe("string");
    expect(body.error).toBeTruthy();
  });
});
