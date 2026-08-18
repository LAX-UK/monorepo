import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";

describe("WS ticket environment", () => {
  it("defaults to the shared one-time ticket store", () => {
    const env = envSchema.parse({});
    expect(env.REDIS_URL).toBe("redis://127.0.0.1:6379");
    expect(env.CORS_ORIGIN).toBe("http://localhost:3000");
  });
});
