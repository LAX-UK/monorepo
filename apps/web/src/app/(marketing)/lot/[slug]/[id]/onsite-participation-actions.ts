"use server";

import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { currentVisitorIp } from "@/lib/http/visitor-ip.server";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { consoleParticipationRequestDispatcher } from "@/lib/onsite/participation-request-dispatcher";
import {
  type OnsiteParticipationContext,
  absenteeBidFormSchema,
} from "@/lib/onsite/participation-request-input";
import { createInMemorySlidingWindowRateLimiter } from "@/lib/rate-limit/in-memory-rate-limiter";

const rateLimiter = createInMemorySlidingWindowRateLimiter({
  windowMs: 60_000,
  maxPerWindow: 6,
});

function rejectHoneypot(website: string | undefined): ActionResult<void> | null {
  if (String(website ?? "").trim()) {
    return actionSuccess();
  }
  return null;
}

export async function submitAbsenteeBidRequest(
  ctx: OnsiteParticipationContext,
  values: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("submitAbsenteeBidRequest", async () => {
    const parsed = absenteeBidFormSchema.safeParse(values);
    if (!parsed.success) {
      return actionFailure("Please check the form and try again.");
    }
    const honeypot = rejectHoneypot(parsed.data.website);
    if (honeypot) return honeypot;

    const key = await currentVisitorIp();
    if (!rateLimiter.consume(key)) {
      return actionFailure("Too many submissions. Please wait a minute and try again.");
    }

    await consoleParticipationRequestDispatcher.dispatch({
      kind: "absentee",
      ...ctx,
      ...parsed.data,
    });
    return actionSuccess();
  });
}
