import type { DataRequestOutcome } from "../../interfaces/identity-data-requests-client.js";
import type { EnquiryErasureCounts } from "./admin-data-requests.service.js";
import type { IHeldErasureRecheckQueue } from "./data-request-held-erasures.js";

/** How many held erasures one run re-runs, and how long it has each one. */
export const HELD_ERASURE_RECHECK_BATCH = 25;
export const HELD_ERASURE_RECHECK_LEASE_MS = 15 * 60_000;

/** Runs a held erasure again, as staff would. */
export interface IHeldErasureRerun {
  rerunHeldErasure(
    reference: string,
    actorUserId: string,
  ): Promise<DataRequestOutcome<EnquiryErasureCounts>>;
}

/** Whether a staff member may still erase for a data request, as the Data requests routes require. */
export interface IHeldErasureActors {
  canManageDataRequests(userId: string): Promise<boolean>;
}

export type HeldErasureRecheckResult = { released: number; waiting: number; needsStaff: number };

/**
 * Re-runs data request erasures a private sale deal held, once the hold's end has passed (or, for
 * an open deal, at each re-check). A completed erasure clears its record and a hold that moved on
 * is kept by the erasure itself, as when staff run it. A request that still cannot complete (the
 * hold should have ended but has not, or the request can no longer be erased by this route) is
 * marked for staff, which raises it on the Data requests queue, and reported once. An Identity
 * outage leaves the claim to run out, so the next run tries again. Safe to run on every API
 * instance at once: each request is claimed by one run.
 */
export class HeldErasureRecheckService {
  constructor(
    private readonly deps: {
      queue: IHeldErasureRecheckQueue;
      erasures: IHeldErasureRerun;
      actors: IHeldErasureActors;
      /** Told once for each request handed to staff; carries the reference and why, nothing else. */
      onNeedsStaff: (reference: string, reason: "still_held" | "cannot_run") => void;
      now?: () => Date;
    },
  ) {}

  async run(): Promise<HeldErasureRecheckResult> {
    const now = this.deps.now?.() ?? new Date();
    const due = await this.deps.queue.claimDue(
      now,
      HELD_ERASURE_RECHECK_BATCH,
      HELD_ERASURE_RECHECK_LEASE_MS,
    );
    const result: HeldErasureRecheckResult = { released: 0, waiting: 0, needsStaff: 0 };
    for (const held of due) {
      // The re-run acts as the staff member who asked, so they must still be allowed to.
      const outcome =
        held.requestedByUserId &&
        (await this.deps.actors.canManageDataRequests(held.requestedByUserId))
          ? await this.deps.erasures.rerunHeldErasure(held.reference, held.requestedByUserId)
          : null;
      if (outcome?.ok && outcome.value.held === 0) {
        result.released += 1;
      } else if (outcome?.ok && held.reason === "open_deal") {
        result.waiting += 1;
      } else {
        const reason = outcome?.ok ? "still_held" : "cannot_run";
        await this.deps.queue.needsStaff(held.reference, reason);
        this.deps.onNeedsStaff(held.reference, reason);
        result.needsStaff += 1;
      }
    }
    return result;
  }
}
