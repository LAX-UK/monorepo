import { describe, expect, it, vi } from "vitest";
import type { RsvpApiError } from "./rsvp-api-error.js";
import { submitRsvp } from "./rsvp-api.js";

describe("submitRsvp", () => {
  it("surfaces validation_failed from errorCode with API message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Plus-one guest name is required",
          errorCode: "validation_failed",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitRsvp({
        email: "guest@example.com",
        attendanceSegment: "full_evening",
        plusOne: 1,
      }),
    ).rejects.toMatchObject({
      name: "RsvpApiError",
      code: "validation_failed",
      message: "Plus-one guest name is required",
    } satisfies Partial<RsvpApiError>);

    vi.unstubAllGlobals();
  });
});
