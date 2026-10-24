import type { EmailSuppressionReason } from "@auction/db/schema";
import type { IEmailSender } from "@auction/email";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type {
  EmailOutboxRow,
  IEmailOutboxRepository,
} from "../interfaces/email-outbox.repository.js";
import { sendEmailUseCase } from "./send-email.use-case.js";

const baseRow: EmailOutboxRow = {
  id: "outbox-1",
  status: "sending",
  attempts: 1,
  toEmailHash: "hash",
  toSnapshot: "user@example.com",
  userId: null,
  template: "shop-checkout-ops-alert",
  vars: {},
  stream: "transactional",
  flaggedAddress: false,
  category: "transactional",
};

describe("sendEmailUseCase claim handling", () => {
  it("does not send when another worker already claimed the row", async () => {
    const send = vi.fn();
    const sender: IEmailSender = { send };
    const outboxRepo: IEmailOutboxRepository = {
      claimForSend: vi.fn(async () => ({
        row: { ...baseRow, status: "sending" as const },
        claimed: false,
      })),
      findSuppression: vi.fn(async () => null),
      markSuppressed: vi.fn(),
      markSent: vi.fn(),
      markFailedOrPending: vi.fn(),
      markSentPersistenceFailed: vi.fn(),
      resolveUserEmail: vi.fn(),
      insertSuppression: vi.fn(),
      recoverStaleForDispatch: vi.fn(async () => []),
    };
    await sendEmailUseCase(
      { outboxRepo, sender, log: pino({ level: "silent" }) },
      { outboxId: "outbox-1" },
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("suppresses inactive Postmark recipients without retrying", async () => {
    const inactive = Object.assign(new Error("Found inactive addresses"), {
      name: "InactiveRecipientsError",
    });
    const sender: IEmailSender = {
      send: vi.fn(async () => {
        throw inactive;
      }),
    };
    const markFailedOrPending = vi.fn();
    const insertSuppression = vi.fn();
    const outboxRepo: IEmailOutboxRepository = {
      claimForSend: vi.fn(async () => ({
        row: { ...baseRow, status: "sending" as const },
        claimed: true,
      })),
      findSuppression: vi.fn(async () => null),
      markSuppressed: vi.fn(),
      markSent: vi.fn(),
      markFailedOrPending,
      markSentPersistenceFailed: vi.fn(),
      resolveUserEmail: vi.fn(),
      insertSuppression,
      recoverStaleForDispatch: vi.fn(async () => []),
    };
    await sendEmailUseCase(
      { outboxRepo, sender, log: pino({ level: "silent" }) },
      { outboxId: "outbox-1" },
    );
    expect(insertSuppression).toHaveBeenCalledWith("hash", "hard_bounce");
    expect(markFailedOrPending).toHaveBeenCalledWith("outbox-1", inactive.message, true);
  });
});

describe("sendEmailUseCase suppression", () => {
  function run(template: string, reason: EmailSuppressionReason | null) {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const markSuppressed = vi.fn();
    const markSent = vi.fn();
    const outboxRepo: IEmailOutboxRepository = {
      claimForSend: vi.fn(async () => ({
        row: { ...baseRow, template, status: "sending" as const },
        claimed: true,
      })),
      findSuppression: vi.fn(async () => reason),
      markSuppressed,
      markSent,
      markFailedOrPending: vi.fn(),
      markSentPersistenceFailed: vi.fn(),
      resolveUserEmail: vi.fn(),
      insertSuppression: vi.fn(),
      recoverStaleForDispatch: vi.fn(async () => []),
    };
    const done = sendEmailUseCase(
      { outboxRepo, sender: { send } as IEmailSender, log: pino({ level: "silent" }) },
      { outboxId: "outbox-1" },
    );
    return { send, markSuppressed, done };
  }

  it("still sends an invoice to someone who unsubscribed", async () => {
    const { send, markSuppressed, done } = run("payment-invoice", "unsubscribe");
    await done;
    expect(send).toHaveBeenCalledTimes(1);
    expect(markSuppressed).not.toHaveBeenCalled();
  });

  it("does not send optional notifications to someone who unsubscribed", async () => {
    const { send, markSuppressed, done } = run("bid-outbid", "unsubscribe");
    await done;
    expect(send).not.toHaveBeenCalled();
    expect(markSuppressed).toHaveBeenCalledWith("outbox-1", "suppressed_after_enqueue");
  });

  it.each(["hard_bounce", "complaint"] as const)(
    "does not send an invoice to an address with a %s",
    async (reason) => {
      const { send, markSuppressed, done } = run("payment-invoice", reason);
      await done;
      expect(send).not.toHaveBeenCalled();
      expect(markSuppressed).toHaveBeenCalled();
    },
  );
});
