import { describe, expect, it, vi } from "vitest";
import { DurableCredentialEmail } from "./durable-credential-email.js";
import {
  DURABLE_RETRY_DELAYS_MS,
  DurableSecurityEffects,
  type SecurityEffectJob,
} from "./durable-security-effects.js";
import { InMemorySecurityEffectOutbox } from "./durable-security-effects.test-util.js";

const START = new Date("2026-11-03T09:00:00.000Z");
const LINK = "https://auth.lax.bid/verify?token=SECRET-LINK-TOKEN";
const INPUT = {
  template: "verify-email",
  to: "person@example.com",
  userId: "user-1",
  category: "auth",
  idempotencyKey: "verify-email:abc123",
  vars: { verificationUrl: LINK, userName: "Person" },
} as const;

function setup(options: { email?: Error; outbox?: Error } = {}) {
  const outbox = new InMemorySecurityEffectOutbox();
  if (options.outbox) {
    outbox.enqueue = vi.fn().mockRejectedValue(options.outbox);
  }
  const email = {
    enqueue: options.email
      ? vi.fn().mockRejectedValue(options.email)
      : vi.fn().mockResolvedValue({ outboxId: "queued-1" }),
  };
  const log = { warn: vi.fn(), error: vi.fn() };
  const sender = new DurableCredentialEmail(email, outbox, log, () => START);
  return { sender, outbox, email, log };
}

const logged = (log: { warn: unknown; error: unknown }) =>
  JSON.stringify([(log.warn as { mock: unknown }).mock, (log.error as { mock: unknown }).mock]);

describe("DurableCredentialEmail", () => {
  it("queues the email straight away and writes nothing to the outbox", async () => {
    const { sender, outbox, email } = setup();

    await sender.send(INPUT);

    expect(email.enqueue).toHaveBeenCalledWith(INPUT);
    expect(outbox.rows).toHaveLength(0);
  });

  it("records the email for retry when the first hand-off fails", async () => {
    const { sender, outbox, log } = setup({ email: new Error("identity_email_enqueue_network") });

    await expect(sender.send(INPUT)).resolves.toBeUndefined();

    expect(outbox.rows).toMatchObject([
      {
        status: "pending",
        job: { kind: "send_identity_email", userId: "user-1", input: INPUT },
        lastError: "identity_email_enqueue_network",
        nextAttemptAt: new Date(START.getTime() + DURABLE_RETRY_DELAYS_MS[0]),
      },
    ]);
    expect(log.warn).toHaveBeenCalledWith(
      { template: "verify-email", failure: "identity_email_enqueue_network" },
      "auth_credential_email_deferred",
    );
  });

  it("rejects, and reports a lost email, only when the outbox cannot take it either", async () => {
    const { sender, log } = setup({
      email: new Error("identity_email_enqueue_unavailable"),
      outbox: new Error("connection refused"),
    });

    await expect(sender.send(INPUT)).rejects.toThrow("auth_credential_email_lost");

    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ template: "verify-email" }),
      "auth_credential_email_lost",
    );
  });

  it("never logs or stores the link, the address or a database error that quotes them", async () => {
    const quoting = new Error(`Failed query: insert ... params: ${LINK},person@example.com`);
    quoting.name = "DrizzleQueryError";
    const { sender, outbox, log } = setup({ email: quoting, outbox: quoting });

    await expect(sender.send(INPUT)).rejects.toThrow();

    const everything = logged(log);
    expect(everything).not.toContain("SECRET-LINK-TOKEN");
    expect(everything).not.toContain("person@example.com");
    expect(everything).not.toContain("Failed query");
    expect(outbox.rows).toHaveLength(0);
  });

  it("stores only a safe failure name for an unexpected error", async () => {
    const quoting = new Error(`params: ${LINK}`);
    const { sender, outbox } = setup({ email: quoting });

    await sender.send(INPUT);

    expect(outbox.rows[0]?.lastError).toBe("Error");
  });
});

describe("retrying a recorded credential email", () => {
  function retrySetup() {
    const base = setup({ email: new Error("identity_email_enqueue_network") });
    const email = { enqueue: vi.fn().mockResolvedValue({ outboxId: "queued-2" }) };
    const log = { warn: vi.fn(), error: vi.fn() };
    const clock = { now: START };
    const effects = new DurableSecurityEffects(
      base.outbox,
      { email } as never,
      log,
      () => clock.now,
    );
    return { ...base, retryEmail: email, effects, log, clock };
  }

  it("sends the same message with the same idempotency key once the delay has passed", async () => {
    const { sender, effects, retryEmail, clock, outbox } = retrySetup();
    await sender.send(INPUT);

    await expect(effects.drain()).resolves.toBe(0);
    clock.now = new Date(START.getTime() + DURABLE_RETRY_DELAYS_MS[0]);
    await expect(effects.drain()).resolves.toBe(1);

    expect(retryEmail.enqueue).toHaveBeenCalledTimes(1);
    expect(retryEmail.enqueue).toHaveBeenCalledWith(INPUT);
    expect(outbox.rows).toHaveLength(0);
  });

  it("keeps retrying with a redacted failure and alerts without personal data when it gives up", async () => {
    const { sender, effects, retryEmail, clock, outbox } = retrySetup();
    const quoting = new Error(`params: ${LINK},person@example.com`);
    retryEmail.enqueue.mockRejectedValue(quoting);
    await sender.send(INPUT);

    for (let attempt = 0; attempt <= DURABLE_RETRY_DELAYS_MS.length; attempt += 1) {
      clock.now = new Date(clock.now.getTime() + 31 * 60_000);
      await effects.drain();
    }

    expect(outbox.rows[0]).toMatchObject({ status: "abandoned", lastError: "Error" });
    const log = (effects as unknown as { log: { warn: unknown; error: unknown } }).log;
    const everything = logged(log);
    expect(everything).toContain("auth_security_effect_abandoned");
    expect(everything).not.toContain("SECRET-LINK-TOKEN");
    expect(everything).not.toContain("person@example.com");
    expect(everything).not.toContain("user-1");
  });

  it("is typed as a security effect job", () => {
    const job: SecurityEffectJob = { kind: "send_identity_email", userId: "u", input: INPUT };
    expect(job.kind).toBe("send_identity_email");
  });
});
