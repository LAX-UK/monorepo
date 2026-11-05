"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLaxAccountContainer } from "../container";
import type { AccountActionResult } from "../domain/account-action-result";
import { ALERT_SWITCH_FAILED_MESSAGE, alertRefusalMessage } from "../domain/account-alerts.vm";
import { ACCOUNT_ROUTES } from "../domain/account-settings.vm";
import { ALERT_TOPIC_IDS } from "../ports/alert-preferences-gateway";
import { loadAccountSessionHandle } from "./load-account-record";

const switchSchema = z.object({ topic: z.enum(ALERT_TOPIC_IDS), on: z.boolean() });

/** Switches one topic's alert emails on or off for the signed-in person, in the product that owns it. */
export async function setAlertTopicAction(input: {
  topic: string;
  on: boolean;
}): Promise<AccountActionResult> {
  const parsed = switchSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: ALERT_SWITCH_FAILED_MESSAGE };
  let handle: Awaited<ReturnType<typeof loadAccountSessionHandle>>;
  try {
    handle = await loadAccountSessionHandle();
  } catch (error) {
    console.error("account_session_load_failed", error);
    return { status: "error", message: ALERT_SWITCH_FAILED_MESSAGE };
  }
  if (!handle) return { status: "reauth_required" };
  const result = await getLaxAccountContainer().alerts.setTopic(handle, parsed.data);
  switch (result.status) {
    case "ok":
      revalidatePath(ACCOUNT_ROUTES.alerts);
      return { status: "ok", message: "All changes saved" };
    case "signed_out":
      return { status: "reauth_required" };
    case "refused":
      return { status: "error", message: alertRefusalMessage(result.reason) };
    case "unavailable":
      return { status: "error", message: ALERT_SWITCH_FAILED_MESSAGE };
  }
}
