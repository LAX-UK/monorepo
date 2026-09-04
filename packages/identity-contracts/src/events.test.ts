import { describe, expect, it } from "vitest";
import {
  IDENTITY_EVENT_TYPES,
  identityEventPayloadSchemasV1,
  userDeletionCancelledPayloadSchemaV1,
  userDeletionRequestedPayloadSchemaV1,
  userProfileUpdatedPayloadSchemaV1,
} from "./events.js";

const base = {
  schemaVersion: 1 as const,
  subjectId: "subject-1",
};

describe("identity event payload contracts", () => {
  it("accepts image changes in profile-updated payloads", () => {
    expect(
      userProfileUpdatedPayloadSchemaV1.parse({
        ...base,
        image: null,
        updatedAt: "2026-08-19T18:00:00.000Z",
      }),
    ).toMatchObject({ image: null });
  });

  it("requires timestamps for deletion lifecycle payloads", () => {
    expect(
      userDeletionRequestedPayloadSchemaV1.parse({
        ...base,
        requestedAt: "2026-08-19T18:00:00.000Z",
      }),
    ).toMatchObject({ subjectId: "subject-1" });
    expect(
      userDeletionCancelledPayloadSchemaV1.parse({
        ...base,
        cancelledAt: "2026-08-19T18:05:00.000Z",
      }),
    ).toMatchObject({ subjectId: "subject-1" });
    expect(userDeletionRequestedPayloadSchemaV1.safeParse(base).success).toBe(false);
    expect(userDeletionCancelledPayloadSchemaV1.safeParse(base).success).toBe(false);
  });

  it("registers deletion lifecycle schemas by event type", () => {
    expect(identityEventPayloadSchemasV1[IDENTITY_EVENT_TYPES.DELETION_REQUESTED]).toBe(
      userDeletionRequestedPayloadSchemaV1,
    );
    expect(identityEventPayloadSchemasV1[IDENTITY_EVENT_TYPES.DELETION_CANCELLED]).toBe(
      userDeletionCancelledPayloadSchemaV1,
    );
  });
});
