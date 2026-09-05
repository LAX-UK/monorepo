import { IDENTITY_EVENT_TYPES, SSF_EVENT_TYPES } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { mapDomainEventToSsf, nextSsfDeliveryAttempt, ssfStaleClaimBefore } from "./ssf.service.js";

const base = {
  id: 42,
  aggregateId: "subject-1",
  correlationId: "d67754ec-61d7-4c97-95f2-06a3be4bfb23",
  occurredAt: new Date("2026-08-13T06:00:00.000Z"),
};

describe("domain event to SSF mapping", () => {
  it("maps session and credential evidence to CAEP events", () => {
    expect(
      mapDomainEventToSsf({
        ...base,
        eventType: IDENTITY_EVENT_TYPES.SESSION_REVOKED,
        payload: { subjectId: "subject-1", sessionId: "session-1" },
      }),
    ).toEqual({
      subjectId: "session-1",
      eventType: SSF_EVENT_TYPES.SESSION_REVOKED,
      event: { event_timestamp: Math.floor(base.occurredAt.getTime() / 1000) },
    });
    expect(
      mapDomainEventToSsf({
        ...base,
        eventType: IDENTITY_EVENT_TYPES.CREDENTIAL_CHANGED,
        payload: { subjectId: "subject-1", changeType: "update" },
      }),
    ).toMatchObject({
      subjectId: "subject-1",
      eventType: SSF_EVENT_TYPES.CREDENTIAL_CHANGE,
      event: { credential_type: "password", change_type: "update" },
    });
  });

  it("uses a private merge event instead of misrepresenting account purge", () => {
    expect(
      mapDomainEventToSsf({
        ...base,
        eventType: IDENTITY_EVENT_TYPES.IDENTITY_MERGED,
        payload: { subjectId: "canonical", retiredSubjectId: "retired" },
      }),
    ).toEqual({
      subjectId: "retired",
      eventType: SSF_EVENT_TYPES.LAX_IDENTITY_MERGED,
      event: { canonical_subject_id: "canonical" },
    });
  });

  it("does not fabricate security events from profile updates", () => {
    expect(
      mapDomainEventToSsf({
        ...base,
        eventType: "user.profile_updated",
        payload: { subjectId: "subject-1" },
      }),
    ).toBeNull();
  });

  it("maps only actual permanent deletion evidence to RISC account-purged", () => {
    expect(
      mapDomainEventToSsf({
        ...base,
        eventType: IDENTITY_EVENT_TYPES.IDENTITY_DELETED,
        payload: { subjectId: "subject-1", deletedAt: base.occurredAt.toISOString() },
      }),
    ).toEqual({
      subjectId: "subject-1",
      eventType: SSF_EVENT_TYPES.ACCOUNT_PURGED,
      event: {},
    });
  });
});

describe("SSF delivery retry policy", () => {
  it("uses bounded exponential backoff and terminal max attempts", () => {
    const now = new Date("2026-08-13T06:00:00Z");
    expect(nextSsfDeliveryAttempt(false, 0, 3, now)).toEqual({
      status: "pending",
      attemptCount: 1,
      nextAttemptAt: new Date("2026-08-13T06:00:15Z"),
    });
    expect(nextSsfDeliveryAttempt(false, 2, 3, now)).toEqual({
      status: "failed",
      attemptCount: 3,
      nextAttemptAt: now,
    });
    expect(nextSsfDeliveryAttempt(true, 1, 3, now)).toEqual({
      status: "delivered",
      attemptCount: 2,
      nextAttemptAt: now,
    });
  });

  it("recovers claims older than twice the request timeout", () => {
    expect(ssfStaleClaimBefore(new Date("2026-08-13T06:00:10Z"), 5_000)).toEqual(
      new Date("2026-08-13T06:00:00Z"),
    );
  });
});
