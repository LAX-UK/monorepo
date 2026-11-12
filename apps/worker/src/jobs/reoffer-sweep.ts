import { invoiceSweepOutcome } from "@auction/domain";
import { Sentry } from "@auction/observability";
import type {
  IReofferInvoiceMarker,
  IReofferSweepReader,
  ReofferSweepRef,
} from "@auction/persistence/interfaces";
import type pino from "pino";
import { reofferSweepTotal } from "../lib/reoffer-sweep-metrics.js";
import type { ReofferClockService } from "../reoffer/reoffer-clock.service.js";

/** More than this many open offers or requests at once would be unusual; the next run takes the rest. */
const SWEEP_BATCH = 200;

/**
 * How long a re-award has to raise its own invoice before the sweep steps in: the API raises it
 * straight after the award, so anything older than this was missed.
 */
export const INVOICE_GRACE_MS = 5 * 60 * 1000;

export type ReofferSweepResult = {
  lapsed: number;
  requestReminders: number;
  ended: number;
  offerReminders: number;
  invoicesRaised: number;
  /** Missed invoices that cannot be raised; each is reported once and marked. */
  invoicesUnraised: number;
  failed: number;
};

type Step = "seller_request" | "offer" | "invoice";

/**
 * The re-offer clock, run every 15 minutes: lapses seller requests nobody answered, ends offers
 * the bidder let run out, sends each reminder once, and raises the invoice of an accepted offer
 * whose award went through but whose invoice did not. Every step re-checks under the lot's lock
 * and is idempotent, so running it as often as we like, or twice at once, changes nothing twice.
 * One offer that cannot be settled is reported and must not stop the rest.
 */
export async function runReofferSweepJob(options: {
  reader: IReofferSweepReader;
  clock: Pick<ReofferClockService, "settleSellerRequest" | "settleOffer">;
  /** Marks an offer whose invoice cannot be raised, so the next run does not list it again. */
  marker: IReofferInvoiceMarker;
  /** Raises the invoice for a re-awarded lot; the finance runtime's idempotent `ensureForLot`. */
  ensureInvoice: ((lotId: string) => Promise<{ created: boolean; reason?: string }>) | null;
  log: pino.Logger;
  now?: () => Date;
}): Promise<ReofferSweepResult> {
  const { reader, clock, marker, ensureInvoice, log, now = () => new Date() } = options;
  const result: ReofferSweepResult = {
    lapsed: 0,
    requestReminders: 0,
    ended: 0,
    offerReminders: 0,
    invoicesRaised: 0,
    invoicesUnraised: 0,
    failed: 0,
  };

  const each = async (
    step: Step,
    refs: ReofferSweepRef[],
    run: (ref: ReofferSweepRef) => Promise<string>,
  ) => {
    for (const ref of refs) {
      try {
        const outcome = await run(ref);
        reofferSweepTotal.inc({ step, outcome });
        tally(result, step, outcome);
        if (outcome !== "waiting" && outcome !== "skipped") {
          log.info({ step, outcome, reofferId: ref.reofferId, lotId: ref.lotId }, "reoffer_step");
        }
      } catch (err) {
        result.failed += 1;
        reofferSweepTotal.inc({ step, outcome: "failed" });
        log.error({ err, step, reofferId: ref.reofferId, lotId: ref.lotId }, "reoffer_step_failed");
        Sentry.captureException(err, {
          tags: { job: "reoffer_sweep", step },
          extra: { reofferId: ref.reofferId, lotId: ref.lotId },
        });
      }
    }
  };

  await each("seller_request", await reader.openSellerRequests(SWEEP_BATCH), (ref) =>
    clock.settleSellerRequest(ref),
  );
  await each("offer", await reader.offersOut(SWEEP_BATCH), (ref) => clock.settleOffer(ref));
  if (ensureInvoice) {
    const missed = await reader.acceptedWithoutInvoice({
      reawardedBefore: new Date(now().getTime() - INVOICE_GRACE_MS),
      limit: SWEEP_BATCH,
    });
    await each("invoice", missed, async (ref) => {
      const outcome = invoiceSweepOutcome(await ensureInvoice(ref.lotId));
      if (outcome.kind === "raised") return "raised";
      // Terminal: another run would get the same answer. Mark first, so a crash re-reports at most once.
      await marker.markInvoiceNotRaised(ref.reofferId, outcome.marker);
      result.invoicesUnraised += 1;
      log.warn(
        { reofferId: ref.reofferId, lotId: ref.lotId, reason: outcome.reason },
        "reoffer_invoice_not_raised",
      );
      Sentry.captureMessage("reoffer sweep: re-awarded lot has no invoice and none can be raised", {
        level: "warning",
        tags: { job: "reoffer_sweep", step: "invoice", reason: outcome.reason },
        extra: { reofferId: ref.reofferId, lotId: ref.lotId },
      });
      return outcome.reason;
    });
  }

  log.info(result, "reoffer sweep done");
  return result;
}

function tally(result: ReofferSweepResult, step: Step, outcome: string): void {
  if (step === "seller_request") {
    if (outcome === "lapsed") result.lapsed += 1;
    if (outcome === "reminded") result.requestReminders += 1;
  } else if (step === "offer") {
    if (outcome === "ended") result.ended += 1;
    if (outcome === "reminded") result.offerReminders += 1;
  } else if (outcome === "raised") {
    result.invoicesRaised += 1;
  }
}
