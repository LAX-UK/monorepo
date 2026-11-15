import { z } from "zod";

/**
 * Zoho CRM owns printing and framing jobs. When a job's quality check passes there, LAX Shop moves
 * that order line's print to "quality check passed", the step before packing. The worker hears
 * Zoho's QC Passed and asks LAX Shop over the inventory machine route; LAX Shop owns the change.
 */
export const QC_READY_TO_PACK_SUBROUTE = "/zoho-qc-passed";

export const qcReadyToPackRequestSchema = z.object({
  /** The order's reference ("LAX-S-10482"), as Zoho's order-reference field carries it. */
  orderReference: z.string().min(1).max(64),
  /** The order line the Zoho job is for: a print line, or the framing line sold with a print. */
  lineId: z.string().uuid(),
});
export type QcReadyToPackRequest = z.infer<typeof qcReadyToPackRequestSchema>;

export const QC_READY_OUTCOMES = [
  /** The print's task is now at quality check passed. */
  "moved",
  /** It already was there or further on; nothing changed. */
  "already",
  /** No such line on that order, or the line has no print task. Staff look at it. */
  "unmatched",
  /** The task is not at a step that can pass the check (queued, failed, cancelled). */
  "not_ready",
  /** A frame sold with the print is still open in LAX Admin. */
  "frame_open",
] as const;
export type QcReadyOutcome = (typeof QC_READY_OUTCOMES)[number];

export const qcReadyToPackAnswerSchema = z.object({ outcome: z.enum(QC_READY_OUTCOMES) });
export type QcReadyToPackAnswer = z.infer<typeof qcReadyToPackAnswerSchema>;
