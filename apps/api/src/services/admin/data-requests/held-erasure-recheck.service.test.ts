import { describe, expect, it, vi } from "vitest";
import type { DataRequestOutcome } from "../../interfaces/identity-data-requests-client.js";
import type { EnquiryErasureCounts } from "./admin-data-requests.service.js";
import type { DueHeldErasure } from "./data-request-held-erasures.js";
import {
  HELD_ERASURE_RECHECK_BATCH,
  HELD_ERASURE_RECHECK_LEASE_MS,
  HeldErasureRecheckService,
} from "./held-erasure-recheck.service.js";

const NOW = new Date("2031-03-02T00:00:00Z");
const counts = (
  held: number,
  hold?: { until: Date | null; withoutEnd: boolean },
): DataRequestOutcome<EnquiryErasureCounts> => ({
  ok: true,
  value: {
    enquiries: held === 0 ? 1 : 0,
    notes: 0,
    attachments: 0,
    held,
    ...(hold ? { hold } : {}),
  } as EnquiryErasureCounts,
});

function setup(due: DueHeldErasure[]) {
  const queue = {
    claimDue: vi.fn(async (_now: Date, _limit: number, _lease: number) => due),
    needsStaff: vi.fn(async (_reference: string, _reason: "still_held" | "cannot_run") => {}),
  };
  const erasures = { rerunHeldErasure: vi.fn(async (_ref: string, _actor: string) => counts(0)) };
  const actors = { canManageDataRequests: vi.fn(async (_userId: string) => true) };
  const onNeedsStaff = vi.fn();
  const service = new HeldErasureRecheckService({
    queue,
    erasures,
    actors,
    onNeedsStaff,
    now: () => NOW,
  });
  return { service, queue, erasures, actors, onNeedsStaff };
}

const held = (over: Partial<DueHeldErasure> = {}): DueHeldErasure => ({
  reference: "DR-0007",
  requestedByUserId: "staff-1",
  reason: "running",
  heldUntil: new Date("2031-03-01T00:00:00Z"),
  ...over,
});

describe("HeldErasureRecheckService", () => {
  it("claims a batch of due requests and re-runs each for the staff member who asked", async () => {
    const { service, queue, erasures, onNeedsStaff } = setup([held()]);
    expect(await service.run()).toEqual({ released: 1, waiting: 0, needsStaff: 0 });
    expect(queue.claimDue).toHaveBeenCalledWith(
      NOW,
      HELD_ERASURE_RECHECK_BATCH,
      HELD_ERASURE_RECHECK_LEASE_MS,
    );
    expect(erasures.rerunHeldErasure).toHaveBeenCalledWith("DR-0007", "staff-1");
    expect(queue.needsStaff).not.toHaveBeenCalled();
    expect(onNeedsStaff).not.toHaveBeenCalled();
  });

  it("leaves a request behind a deal that is still open to wait for the next re-check", async () => {
    const { service, queue, erasures } = setup([held({ reason: "open_deal", heldUntil: null })]);
    erasures.rerunHeldErasure.mockResolvedValueOnce(counts(1, { until: null, withoutEnd: false }));
    expect(await service.run()).toEqual({ released: 0, waiting: 1, needsStaff: 0 });
    expect(queue.needsStaff).not.toHaveBeenCalled();
  });

  it("leaves a request whose hold moved to a later date waiting under the plan the re-run stored", async () => {
    const { service, queue, erasures, onNeedsStaff } = setup([held()]);
    const later = new Date("2031-06-01T00:00:00Z");
    erasures.rerunHeldErasure.mockResolvedValueOnce(counts(1, { until: later, withoutEnd: false }));
    expect(await service.run()).toEqual({ released: 0, waiting: 1, needsStaff: 0 });
    expect(queue.needsStaff).not.toHaveBeenCalled();
    expect(onNeedsStaff).not.toHaveBeenCalled();
  });

  it("hands staff a request whose hold end has passed and is still held", async () => {
    const { service, queue, erasures } = setup([held()]);
    erasures.rerunHeldErasure.mockResolvedValueOnce(
      counts(1, { until: new Date("2031-03-01T00:00:00Z"), withoutEnd: false }),
    );
    expect(await service.run()).toEqual({ released: 0, waiting: 0, needsStaff: 1 });
    expect(queue.needsStaff).toHaveBeenCalledWith("DR-0007", "still_held");
  });

  it("hands staff a request still held after its hold should have ended, and says so once", async () => {
    const { service, queue, erasures, onNeedsStaff } = setup([held()]);
    erasures.rerunHeldErasure.mockResolvedValueOnce(counts(1));
    expect(await service.run()).toEqual({ released: 0, waiting: 0, needsStaff: 1 });
    expect(queue.needsStaff).toHaveBeenCalledWith("DR-0007", "still_held");
    expect(onNeedsStaff).toHaveBeenCalledTimes(1);
    expect(onNeedsStaff).toHaveBeenCalledWith("DR-0007", "still_held");
  });

  it("hands staff a request the re-run refuses, such as one closed meanwhile", async () => {
    const { service, queue, erasures } = setup([held()]);
    erasures.rerunHeldErasure.mockResolvedValueOnce({
      ok: false,
      status: 409,
      error: "erasure_not_allowed",
    });
    await service.run();
    expect(queue.needsStaff).toHaveBeenCalledWith("DR-0007", "cannot_run");
  });

  it("does not re-run a request whose staff member's account is gone", async () => {
    const { service, queue, erasures } = setup([held({ requestedByUserId: null })]);
    await service.run();
    expect(erasures.rerunHeldErasure).not.toHaveBeenCalled();
    expect(queue.needsStaff).toHaveBeenCalledWith("DR-0007", "cannot_run");
  });

  it("hands staff a request whose staff member no longer holds the capability, without re-running it", async () => {
    const { service, queue, erasures, actors, onNeedsStaff } = setup([held()]);
    actors.canManageDataRequests.mockResolvedValueOnce(false);
    expect(await service.run()).toEqual({ released: 0, waiting: 0, needsStaff: 1 });
    expect(actors.canManageDataRequests).toHaveBeenCalledWith("staff-1");
    expect(erasures.rerunHeldErasure).not.toHaveBeenCalled();
    expect(queue.needsStaff).toHaveBeenCalledWith("DR-0007", "cannot_run");
    expect(onNeedsStaff).toHaveBeenCalledWith("DR-0007", "cannot_run");
  });

  it("leaves the claim to run out when Identity cannot be reached, so the next run tries again", async () => {
    const { service, queue, erasures } = setup([held()]);
    erasures.rerunHeldErasure.mockRejectedValueOnce(new Error("identity_unavailable"));
    await expect(service.run()).rejects.toThrow("identity_unavailable");
    expect(queue.needsStaff).not.toHaveBeenCalled();
  });
});
