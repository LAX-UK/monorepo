import { type EmailLiftRefusal, emailLiftRefusalWords } from "@auction/domain";
import type { Context } from "hono";
import type { LiftEmailBlockOutcome } from "../services/admin/email-delivery/lift-email-block.service.js";

const REFUSAL_STATUS = {
  unsubscribe_not_liftable: 422,
  administrator_only: 403,
  not_allowed: 403,
  reason_not_accepted: 422,
  note_required: 422,
  written_request_required: 422,
} as const satisfies Record<EmailLiftRefusal, 403 | 422>;

/** One answer shape for every route that lifts an email block. */
export function liftOutcomeResponse(c: Context, outcome: LiftEmailBlockOutcome) {
  if (outcome.ok) return c.json({ ok: true, data: { provider: outcome.provider } });
  if (outcome.error === "refused") {
    return c.json(
      { error: outcome.refusal, message: emailLiftRefusalWords(outcome.refusal) },
      REFUSAL_STATUS[outcome.refusal],
    );
  }
  return c.json(
    {
      error: outcome.error,
      liftedAt: outcome.lifted?.at.toISOString() ?? null,
      liftedBy: outcome.lifted
        ? { userId: outcome.lifted.byUserId, name: outcome.lifted.byName }
        : null,
    },
    409,
  );
}
