import { STAFF_STEP_UP_MAX_AGE_SECONDS } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import type { IdentitySession } from "./interfaces/identity-issuer-client.js";
import { StaffStepUpService } from "./staff-step-up.service.js";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const SUBJECT = "subject-1";
const SESSION_ID = "session-1";

function secondsAgo(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

function session(overrides: Partial<IdentitySession> = {}): IdentitySession {
  return {
    id: SESSION_ID,
    createdAt: secondsAgo(60),
    expiresAt: new Date(NOW.getTime() + 3_600_000),
    ipAddress: null,
    userAgent: null,
    lastPasswordAuthAt: null,
    isCurrent: true,
    ...overrides,
  };
}

function guardFor(rows: IdentitySession[]) {
  const listSessions = vi.fn().mockResolvedValue(rows);
  return { guard: new StaffStepUpService({ listSessions }, { now: () => NOW }), listSessions };
}

describe("StaffStepUpService", () => {
  it("is recent when the session began inside the window, and asks Identity about that session", async () => {
    const { guard, listSessions } = guardFor([session()]);

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: SESSION_ID })).resolves.toBe(true);
    expect(listSessions).toHaveBeenCalledWith(SUBJECT, SESSION_ID);
  });

  it("is not recent when the session is older than the shared window", async () => {
    const { guard } = guardFor([
      session({ createdAt: secondsAgo(STAFF_STEP_UP_MAX_AGE_SECONDS + 1) }),
    ]);

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: SESSION_ID })).resolves.toBe(
      false,
    );
  });

  it("is recent exactly at the edge of the window", async () => {
    const { guard } = guardFor([session({ createdAt: secondsAgo(STAFF_STEP_UP_MAX_AGE_SECONDS) })]);

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: SESSION_ID })).resolves.toBe(true);
  });

  it("counts a recent password confirmation on an old session", async () => {
    const { guard } = guardFor([
      session({ createdAt: secondsAgo(86_400), lastPasswordAuthAt: secondsAgo(30) }),
    ]);

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: SESSION_ID })).resolves.toBe(true);
  });

  it("ignores an old password confirmation", async () => {
    const { guard } = guardFor([
      session({ createdAt: secondsAgo(86_400), lastPasswordAuthAt: secondsAgo(7_200) }),
    ]);

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: SESSION_ID })).resolves.toBe(
      false,
    );
  });

  it("is not recent when the session is not among the person's sessions", async () => {
    const { guard } = guardFor([session({ id: "other-session", isCurrent: false })]);

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: SESSION_ID })).resolves.toBe(
      false,
    );
  });

  it("is not recent for an expired session, however new", async () => {
    const { guard } = guardFor([session({ expiresAt: secondsAgo(1) })]);

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: SESSION_ID })).resolves.toBe(
      false,
    );
  });

  it("finds the session by the token Identity marks as current", async () => {
    const { guard } = guardFor([session({ id: "row-id", isCurrent: true })]);

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: "the-token" })).resolves.toBe(
      true,
    );
  });

  it("honours a custom window", async () => {
    const listSessions = vi.fn().mockResolvedValue([session({ createdAt: secondsAgo(120) })]);
    const guard = new StaffStepUpService({ listSessions }, { now: () => NOW, maxAgeSeconds: 60 });

    await expect(guard.isRecent({ subjectId: SUBJECT, sessionId: SESSION_ID })).resolves.toBe(
      false,
    );
  });
});
