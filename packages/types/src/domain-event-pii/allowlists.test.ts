import { describe, expect, it } from "vitest";
import { isExceptionPath } from "./allowlists.js";
import { redactDomainEventPayload } from "./redact.js";

describe("isExceptionPath", () => {
  it("matches a listed key exactly", () => {
    expect(isExceptionPath("collection.booking.created", "reference")).toBe(true);
    expect(isExceptionPath("collection.booking.created", "collectorName")).toBe(false);
  });

  it("covers the elements of a listed array", () => {
    expect(isExceptionPath("collection.booking.created", "lotIds.0")).toBe(true);
    expect(isExceptionPath("collection.booking.created", "lotIds.12")).toBe(true);
    expect(isExceptionPath("collection.booking.created", "other.0")).toBe(false);
  });

  it("does not let a number stand in for a key", () => {
    expect(isExceptionPath("collection.booking.created", "0")).toBe(false);
  });

  it("knows nothing about an event with no list", () => {
    expect(isExceptionPath("no.such.event", "reference")).toBe(false);
  });
});

describe("redacting an array the event lists", () => {
  it("keeps the listed array's text and hides an unlisted one", () => {
    const redacted = redactDomainEventPayload("collection.booking.created", {
      lotIds: ["a-lot", "another"],
      notes: ["Sam Okoro"],
    }) as { lotIds: string[]; notes: string[] };
    expect(redacted.lotIds).toEqual(["a-lot", "another"]);
    expect(redacted.notes).toEqual(["[REDACTED]"]);
  });
});
