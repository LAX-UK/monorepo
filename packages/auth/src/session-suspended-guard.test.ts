import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import type { SubjectStatusReader } from "./ports/subject-status-reader.js";
import { assertUserNotSuspendedForSession } from "./session-suspended-guard.js";

describe("assertUserNotSuspendedForSession", () => {
  it("rejects globally disabled users with APIError 403", async () => {
    const reader: SubjectStatusReader = {
      isDisabledOrMerged: vi.fn().mockResolvedValue(true),
    };

    await expect(assertUserNotSuspendedForSession(reader, "u1")).rejects.toSatisfy(
      (err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiErr = err as APIError;
        expect(apiErr.statusCode).toBe(403);
        expect(apiErr.body?.code).toBe("IDENTITY_DISABLED");
        return true;
      },
    );
  });

  it("allows active users", async () => {
    const reader: SubjectStatusReader = {
      isDisabledOrMerged: vi.fn().mockResolvedValue(false),
    };

    await expect(assertUserNotSuspendedForSession(reader, "u1")).resolves.toBeUndefined();
  });
});
