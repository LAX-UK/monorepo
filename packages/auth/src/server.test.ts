import type { Database } from "@auction/db";
import { describe, expect, it } from "vitest";
import { createAuth } from "./server.js";

describe("createAuth", () => {
  it("boots when Apple Sign-In is feature-flagged off", () => {
    expect(() =>
      createAuth({
        db: {} as Database,
        secret: "test-secret-that-is-long-enough",
        baseURL: "http://localhost:3001",
        issuerURL: "http://localhost:3001",
        appleClientId: undefined,
        appleClientSecret: undefined,
      }),
    ).not.toThrow();
  });
});
