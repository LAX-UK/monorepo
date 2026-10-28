"use server";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { X_LEGAL_ENTITY_ID_HEADER } from "./client-acting-context";

export type MembershipActionResult = { ok: true } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  forbidden: "Your role in this organisation cannot do this.",
  not_found: "Your membership of this organisation was not found.",
};

async function failure(res: Response): Promise<MembershipActionResult> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return {
    ok: false,
    error: MESSAGES[body.error ?? ""] ?? "Something went wrong. Please try again.",
  };
}

/** Closes the welcome card for good, on every device. */
export async function dismissWelcomeAction(legalEntityId: string): Promise<MembershipActionResult> {
  return instrumentServerAction("dismissWelcomeAction", async () => {
    const res = await authedServerFetch("/legal-entities/membership/welcome-dismissal", {
      method: "POST",
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
    });
    if (!res.ok) return failure(res);
    revalidatePath(CLIENT_ROUTES.home);
    return { ok: true };
  });
}
