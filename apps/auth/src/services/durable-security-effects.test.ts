import { describe, expect, it, vi } from "vitest";
import {
  DURABLE_RETRY_DELAYS_MS,
  DurableSecurityEffects,
  type SecurityEffectJob,
} from "./durable-security-effects.js";
import { InMemorySecurityEffectOutbox } from "./durable-security-effects.test-util.js";

const START = new Date("2026-10-23T12:00:00.000Z");
const JOB: SecurityEffectJob = {
  kind: "revoke_tokens_except_session",
  userId: "subject-1",
  keepSessionId: "session-1",
};

function setup(outbox = new InMemorySecurityEffectOutbox()) {
  const clock = { now: START };
  const logout = {
    revokeIdentitySessions: vi.fn(async () => 1),
    revokeSubject: vi.fn(async () => 1),
    revokeSubjectExceptIdentitySession: vi.fn(async () => 1),
  };
  const operations = { removeOtherSessions: vi.fn(async () => ["other"]) };
  const events = { publish: vi.fn(async () => undefined) };
  const log = { warn: vi.fn(), error: vi.fn() };
  const build = () =>
    new DurableSecurityEffects(
      outbox,
      { operations, logout, events } as never,
      log,
      () => clock.now,
    );
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  return { effects: build(), build, outbox, logout, operations, events, log, advance };
}

describe("DurableSecurityEffects", () => {
  it("runs the effect immediately and writes nothing when it succeeds", async () => {
    const { effects, outbox, logout } = setup();

    await effects.settle("/two-factor/disable", JOB);

    expect(logout.revokeSubjectExceptIdentitySession).toHaveBeenCalledWith(
      "subject-1",
      "session-1",
    );
    expect(outbox.rows).toHaveLength(0);
  });

  it("records a failed effect with its error so it can be retried after a restart", async () => {
    const { effects, outbox, logout, log } = setup();
    logout.revokeSubjectExceptIdentitySession.mockRejectedValueOnce(new Error("redis down"));

    await effects.settle("/two-factor/disable", JOB);

    expect(outbox.rows).toMatchObject([
      {
        job: JOB,
        status: "pending",
        attemptCount: 1,
        lastError: "redis down",
        nextAttemptAt: new Date(START.getTime() + DURABLE_RETRY_DELAYS_MS[0]),
      },
    ]);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        effect: "revoke_tokens_except_session",
        userId: "subject-1",
        attempt: 1,
      }),
      "auth_security_effect_failed",
    );
  });

  it("uses the request's own first attempt but retries with the job alone", async () => {
    const { effects, outbox, operations, advance, build } = setup();
    const first = vi.fn().mockRejectedValue(new Error("cookie path failed"));

    await effects.settle(
      "/two-factor/verify-totp",
      { kind: "end_other_identity_sessions", userId: "subject-1", keepSessionId: "session-1" },
      first,
    );
    expect(operations.removeOtherSessions).not.toHaveBeenCalled();

    advance(DURABLE_RETRY_DELAYS_MS[0]);
    await build().drain();

    expect(operations.removeOtherSessions).toHaveBeenCalledWith("subject-1", "session-1");
    expect(outbox.rows).toHaveLength(0);
  });

  it("still retries after a restart between attempts", async () => {
    const first = setup();
    first.logout.revokeSubjectExceptIdentitySession.mockRejectedValue(new Error("redis down"));
    await first.effects.settle("/two-factor/disable", JOB);

    // The process dies here: only the outbox rows survive, in the database.
    const restarted = setup(first.outbox);
    restarted.advance(DURABLE_RETRY_DELAYS_MS[0]);
    await expect(restarted.build().drain()).resolves.toBe(1);

    expect(restarted.logout.revokeSubjectExceptIdentitySession).toHaveBeenCalledWith(
      "subject-1",
      "session-1",
    );
    expect(first.outbox.rows).toHaveLength(0);
    expect(restarted.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ effect: "revoke_tokens_except_session", attempt: 2 }),
      "auth_security_effect_recovered",
    );
  });

  it("does not retry before the next attempt is due", async () => {
    const { effects, outbox, logout, build } = setup();
    logout.revokeSubjectExceptIdentitySession.mockRejectedValue(new Error("redis down"));
    await effects.settle("/two-factor/disable", JOB);

    await expect(build().drain()).resolves.toBe(0);
    expect(outbox.rows).toHaveLength(1);
  });

  it("backs off between durable retries", async () => {
    const { effects, outbox, logout, advance, build } = setup();
    logout.revokeSubjectExceptIdentitySession.mockRejectedValue(new Error("redis down"));
    await effects.settle("/two-factor/disable", JOB);

    advance(DURABLE_RETRY_DELAYS_MS[0]);
    await build().drain();

    expect(outbox.rows[0]).toMatchObject({
      status: "pending",
      attemptCount: 2,
      nextAttemptAt: new Date(
        START.getTime() + DURABLE_RETRY_DELAYS_MS[0] + DURABLE_RETRY_DELAYS_MS[1],
      ),
    });
  });

  it("logs auth_security_effect_abandoned only once the durable retries are exhausted", async () => {
    const { effects, outbox, logout, log, advance, build } = setup();
    logout.revokeSubjectExceptIdentitySession.mockRejectedValue(new Error("redis down"));
    await effects.settle("/two-factor/disable", JOB);

    for (const delay of DURABLE_RETRY_DELAYS_MS) {
      expect(log.error).not.toHaveBeenCalledWith(
        expect.anything(),
        "auth_security_effect_abandoned",
      );
      advance(delay);
      await build().drain();
    }

    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ effect: "revoke_tokens_except_session", userId: "subject-1" }),
      "auth_security_effect_abandoned",
    );
    expect(outbox.rows[0]).toMatchObject({ status: "abandoned", lastError: "redis down" });
    expect(logout.revokeSubjectExceptIdentitySession).toHaveBeenCalledTimes(
      1 + DURABLE_RETRY_DELAYS_MS.length,
    );
    advance(DURABLE_RETRY_DELAYS_MS.at(-1) ?? 0);
    await expect(build().drain()).resolves.toBe(0);
  });

  it("takes back a job whose worker stopped while running it", async () => {
    const { effects, outbox, logout, advance, build } = setup();
    logout.revokeSubjectExceptIdentitySession.mockRejectedValueOnce(new Error("redis down"));
    await effects.settle("/two-factor/disable", JOB);
    // A worker claims the row and dies before finishing.
    const claimed = outbox.rows[0];
    if (claimed) Object.assign(claimed, { status: "running", claimedAt: START });
    advance(5 * 60_000);

    await expect(build().drain()).resolves.toBe(1);
    expect(outbox.rows).toHaveLength(0);
  });

  it("falls back to in-process retries when the outbox itself is unavailable", async () => {
    vi.useFakeTimers();
    try {
      const { effects, outbox, logout, log } = setup();
      logout.revokeSubjectExceptIdentitySession
        .mockRejectedValueOnce(new Error("redis down"))
        .mockResolvedValue(1);
      outbox.enqueue = vi.fn().mockRejectedValue(new Error("database down"));

      await effects.settle("/two-factor/disable", JOB);
      expect(log.error).toHaveBeenCalledWith(expect.anything(), "auth_security_effect_not_durable");

      await vi.advanceTimersByTimeAsync(2_000);
      expect(logout.revokeSubjectExceptIdentitySession).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [
      { kind: "revoke_identity_sessions", userId: "u", sessionIds: ["a", "b"] } as const,
      (s: ReturnType<typeof setup>) => s.logout.revokeIdentitySessions,
      [[["a", "b"]]],
    ],
    [
      { kind: "revoke_subject_tokens", userId: "u" } as const,
      (s: ReturnType<typeof setup>) => s.logout.revokeSubject,
      [["u"]],
    ],
  ])("runs %j", async (job, target, calls) => {
    const s = setup();
    await s.effects.settle("/x", job);
    expect(target(s).mock.calls).toEqual(calls);
  });

  it("publishes identity events", async () => {
    const { effects, events } = setup();
    await effects.settle("/x", { kind: "publish_credential_changed", userId: "u" });
    await effects.settle("/x", { kind: "publish_session_revoked", userId: "u", sessionId: "s" });
    expect(events.publish).toHaveBeenNthCalledWith(1, {
      type: "user.credential_changed",
      userId: "u",
      changeType: "update",
    });
    expect(events.publish).toHaveBeenNthCalledWith(2, {
      type: "user.session_revoked",
      userId: "u",
      sessionId: "s",
    });
  });
});
