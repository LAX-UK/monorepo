import type { Database } from "@auction/db";
import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import { assertUserNotSuspendedForSession } from "./session-suspended-guard.js";

describe("assertUserNotSuspendedForSession", () => {
  it("rejects suspended users with APIError 403", async () => {
    const db = {
      query: {
        user: {
          findFirst: vi.fn().mockResolvedValue({ suspendedAt: new Date("2026-01-01") }),
        },
      },
    } as unknown as Database;

    await expect(assertUserNotSuspendedForSession(db, "u1")).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(APIError);
      const apiErr = err as APIError;
      expect(apiErr.statusCode).toBe(403);
      expect(apiErr.body?.code).toBe("ACCOUNT_SUSPENDED");
      return true;
    });
  });

  it("allows active users", async () => {
    const db = {
      query: {
        user: {
          findFirst: vi.fn().mockResolvedValue({ suspendedAt: null }),
        },
      },
    } as unknown as Database;

    await expect(assertUserNotSuspendedForSession(db, "u1")).resolves.toBeUndefined();
  });
});
