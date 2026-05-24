import { describe, expect, it, vi } from "vitest";
import { KycResubmissionNotifier } from "./kyc-resubmission-notifier.js";

describe("KycResubmissionNotifier", () => {
  it("enqueues email and creates in-app notification", async () => {
    const users = {
      findById: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.com", name: "Alex" }),
    };
    const email = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const notifications = { createMany: vi.fn().mockResolvedValue(undefined) };
    const notifier = new KycResubmissionNotifier(
      users as never,
      email as never,
      notifications as never,
      "https://test.lax.bid",
    );

    await notifier.notify("u1", {
      headline: "More information needed",
      detail: "Retake selfie",
      action: "continue",
      reasonCode: 202,
      decisionStatus: "resubmission_requested",
      needsResubmit: true,
    });

    expect(email.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "kyc-resubmission-required",
        to: "a@b.com",
        userId: "u1",
      }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "u1",
        type: "kyc_resubmission_required",
        title: "More information needed",
      }),
    ]);
  });

  it("no-ops when user has no email", async () => {
    const users = { findById: vi.fn().mockResolvedValue({ id: "u1", email: null, name: "Alex" }) };
    const email = { enqueue: vi.fn() };
    const notifications = { createMany: vi.fn() };
    const notifier = new KycResubmissionNotifier(
      users as never,
      email as never,
      notifications as never,
      "https://test.lax.bid",
    );

    await notifier.notify("u1", {
      headline: "More information needed",
      detail: null,
      action: "continue",
      reasonCode: null,
      decisionStatus: null,
      needsResubmit: true,
    });

    expect(email.enqueue).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
