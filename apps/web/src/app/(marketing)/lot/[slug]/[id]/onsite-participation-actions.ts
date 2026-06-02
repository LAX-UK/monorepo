"use server";

import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { consoleParticipationRequestDispatcher } from "@/lib/onsite/participation-request-dispatcher";
import {
  type OnsiteParticipationContext,
  absenteeBidFormSchema,
  telephoneBidFormSchema,
} from "@/lib/onsite/participation-request-input";
import { createInMemorySlidingWindowRateLimiter } from "@/lib/rate-limit/in-memory-rate-limiter";
import { headers } from "next/headers";

const rateLimiter = createInMemorySlidingWindowRateLimiter({
  windowMs: 60_000,
  maxPerWindow: 6,
});

async function rateLimitKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  return ip;
}

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

    const key = await rateLimitKey();
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

export async function submitTelephoneBidRequest(
  ctx: OnsiteParticipationContext,
  values: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("submitTelephoneBidRequest", async () => {
    const parsed = telephoneBidFormSchema.safeParse(values);
    if (!parsed.success) {
      return actionFailure("Please check the form and try again.");
    }
    const honeypot = rejectHoneypot(parsed.data.website);
    if (honeypot) return honeypot;

    const key = await rateLimitKey();
    if (!rateLimiter.consume(key)) {
      return actionFailure("Too many submissions. Please wait a minute and try again.");
    }

    await consoleParticipationRequestDispatcher.dispatch({
      kind: "telephone",
      ...ctx,
      ...parsed.data,
    });
    return actionSuccess();
  });
}
