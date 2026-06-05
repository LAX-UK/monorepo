import { describe, expect, it } from "vitest";
import { submitOnsiteEventRsvpBodySchema } from "./onsite-event.js";

describe("submitOnsiteEventRsvpBodySchema", () => {
  it("accepts valid RSVP with guest name when plus-one is set", () => {
    const result = submitOnsiteEventRsvpBodySchema.safeParse({
      email: "guest@example.com",
      attendanceSegment: "full_evening",
      plusOne: 1,
      plusOneGuestName: "Jane Doe",
    });
    expect(result.success).toBe(true);
  });

  it("rejects plus-one without guest name", () => {
    const result = submitOnsiteEventRsvpBodySchema.safeParse({
      email: "guest@example.com",
      attendanceSegment: "full_evening",
      plusOne: 1,
    });
    expect(result.success).toBe(false);
  });
});
