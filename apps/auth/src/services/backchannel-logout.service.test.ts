import { describe, expect, it, vi } from "vitest";
import { BackchannelLogoutDeliveryWorker } from "./backchannel-logout-delivery.worker.js";
import { BackchannelLogoutRevocationCoordinator } from "./backchannel-logout-revocation.service.js";
import type {
  BackchannelLogoutDeliveryRepository,
  RpLogoutRepository,
} from "./backchannel-logout.ports.js";

describe("back-channel logout services", () => {
  it("delegates revocation and atomic outbox enqueue as one repository operation", async () => {
    const revokeIdentitySessionsAndEnqueue = vi.fn().mockResolvedValue(2);
    const repository = {
      revokeIdentitySessionsAndEnqueue,
      revokeSubjectAndEnqueue: vi.fn(),
      revokeClientSubjectAndEnqueue: vi.fn(),
    } satisfies RpLogoutRepository;
    const now = new Date("2026-08-13T06:00:00Z");
    const service = new BackchannelLogoutRevocationCoordinator(repository, () => now);

    await expect(service.revokeIdentitySessions(["identity-1", "identity-2"])).resolves.toBe(2);
    expect(revokeIdentitySessionsAndEnqueue).toHaveBeenCalledOnce();
    expect(revokeIdentitySessionsAndEnqueue).toHaveBeenCalledWith(
      ["identity-1", "identity-2"],
      now,
    );
  });

  it("uses the atomic repository contract for subject-wide and client-subject fan-out", async () => {
    const now = new Date("2026-08-13T06:00:00Z");
    const repository = {
      revokeIdentitySessionsAndEnqueue: vi.fn(),
      revokeSubjectAndEnqueue: vi.fn().mockResolvedValue(3),
      revokeClientSubjectAndEnqueue: vi.fn().mockResolvedValue(1),
    } satisfies RpLogoutRepository;
    const service = new BackchannelLogoutRevocationCoordinator(repository, () => now);

    await expect(service.revokeSubject("subject-1")).resolves.toBe(3);
    await expect(service.revokeClientSubject("client-1", "subject-1")).resolves.toBe(1);
    expect(repository.revokeSubjectAndEnqueue).toHaveBeenCalledWith("subject-1", now);
    expect(repository.revokeClientSubjectAndEnqueue).toHaveBeenCalledWith(
      "client-1",
      "subject-1",
      now,
    );
  });

  it("claims, signs, dispatches, and finalizes each delivery", async () => {
    const finalize = vi.fn();
    const deliveries = {
      claimDue: vi.fn().mockResolvedValue([
        {
          id: "delivery-1",
          clientId: "client-1",
          subjectId: "subject-1",
          sid: "sid-1",
          endpoint: "https://rp.test/logout",
          tokenJti: "jti-1",
          tokenIat: 1_786_600_800,
          attemptCount: 0,
        },
      ]),
      finalize,
    } satisfies BackchannelLogoutDeliveryRepository;
    const worker = new BackchannelLogoutDeliveryWorker(
      deliveries,
      "https://issuer.test/",
      { signLogoutToken: vi.fn().mockResolvedValue("logout.jwt") },
      { dispatch: vi.fn().mockResolvedValue({ status: 204 }) },
      () => new Date("2026-08-13T06:00:00Z"),
    );

    await expect(worker.drain()).resolves.toBe(1);
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ id: "delivery-1", status: "delivered", attemptCount: 1 }),
    );
  });

  it("marks the eighth failed attempt terminal", async () => {
    const finalize = vi.fn();
    const worker = new BackchannelLogoutDeliveryWorker(
      {
        claimDue: vi.fn().mockResolvedValue([
          {
            id: "delivery-1",
            clientId: "client-1",
            subjectId: "subject-1",
            sid: null,
            endpoint: "https://rp.test/logout",
            tokenJti: "jti-1",
            tokenIat: 1,
            attemptCount: 7,
          },
        ]),
        finalize,
      },
      "https://issuer.test",
      { signLogoutToken: vi.fn().mockResolvedValue("logout.jwt") },
      { dispatch: vi.fn().mockRejectedValue(new Error("offline")) },
      () => new Date("2026-08-13T06:00:00Z"),
    );

    await worker.drain();
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", attemptCount: 8, errorMessage: "offline" }),
    );
  });

  it("records a non-2xx response and schedules a retry before terminal exhaustion", async () => {
    const finalize = vi.fn();
    const worker = new BackchannelLogoutDeliveryWorker(
      {
        claimDue: vi.fn().mockResolvedValue([
          {
            id: "delivery-1",
            clientId: "client-1",
            subjectId: "subject-1",
            sid: "sid-1",
            endpoint: "https://rp.test/logout",
            tokenJti: "jti-1",
            tokenIat: 1,
            attemptCount: 2,
          },
        ]),
        finalize,
      },
      "https://issuer.test",
      { signLogoutToken: vi.fn().mockResolvedValue("logout.jwt") },
      { dispatch: vi.fn().mockResolvedValue({ status: 503 }) },
      () => new Date("2026-08-13T06:00:00Z"),
    );

    await worker.drain();

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        attemptCount: 3,
        statusCode: 503,
        errorMessage: "receiver_http_503",
        deliveredAt: null,
      }),
    );
  });
});
