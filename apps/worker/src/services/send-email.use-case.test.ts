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
      findSuppression: vi.fn(async () => false),
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
});
