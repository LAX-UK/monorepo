import "server-only";

import { personEmailDeliverySchema } from "@/lib/data/http/admin-email-delivery.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { safeReadData } from "@/lib/data/http/envelope";
import type { PersonEmailDeliveryView } from "@auction/types";

/** What the panel shows: the person's email delivery, or why it can't. */
export type EmailDeliveryLoad =
  | { status: "ready"; view: PersonEmailDeliveryView }
  | { status: "no_address" }
  | { status: "error" };

/**
 * One person's email delivery. A failed read is a state of its own rather than a thrown error,
 * so the panel can say so while the rest of the person's page loads.
 */
export async function getPersonEmailDelivery(userId: string): Promise<EmailDeliveryLoad> {
  try {
    const res = await authedServerFetch(
      `/admin/users/${encodeURIComponent(userId)}/email-delivery`,
    );
    const view = await safeReadData(res, personEmailDeliverySchema, {
      context: "GET /admin/users/:id/email-delivery",
      nullStatuses: [404],
    });
    return view ? { status: "ready", view } : { status: "no_address" };
  } catch {
    return { status: "error" };
  }
}
