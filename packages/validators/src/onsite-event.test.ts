import { describe, expect, it } from "vitest";
import {
  ONSITE_EVENT_RESERVED_SLUGS,
  createOnsiteEventBodySchema,
  submitOnsiteEventRsvpBodySchema,
} from "./onsite-event.js";

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

describe("createOnsiteEventBodySchema", () => {
  it("accepts nullable sale link for saleroom correlation", () => {
    const result = createOnsiteEventBodySchema.safeParse({
      slug: "lax002",
      title: "Second evening",
      segmentOptions: [{ value: "full_evening", label: "Full evening" }],
      saleId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects reserved slugs that would collide with microsite routes", () => {
    for (const slug of ONSITE_EVENT_RESERVED_SLUGS) {
      const result = createOnsiteEventBodySchema.safeParse({
        slug,
        title: "Collision test",
        segmentOptions: [{ value: "full_evening", label: "Full evening" }],
      });
      expect(result.success).toBe(false);
    }
  });
});
