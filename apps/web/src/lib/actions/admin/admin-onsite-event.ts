"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { onsiteEventSlugSchema } from "@/lib/data/http/onsite-event.schema";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { createOnsiteEventBodySchema, updateOnsiteEventBodySchema } from "@auction/validators";
import { redirect } from "next/navigation";

export async function adminCreateOnsiteEventAction(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  return instrumentServerAction("adminCreateOnsiteEventAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const parsed = createOnsiteEventBodySchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const res = await authedServerFetch("/admin/event-rsvps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await readJsonBody(res);
    if (!res.ok) {
      const payload = body as { error?: string };
      return actionFailure(payload.error ?? "Could not create event");
    }
    const { slug } = readDataEnvelope(body, onsiteEventSlugSchema, "POST /admin/event-rsvps");
    if (!slug) return actionFailure("Unexpected response from server");
    redirect(`/admin/event-rsvps/${encodeURIComponent(slug)}`);
  });
}

export async function adminUpdateOnsiteEventAction(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  return instrumentServerAction("adminUpdateOnsiteEventAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const parsed = updateOnsiteEventBodySchema
      .extend({ slug: createOnsiteEventBodySchema.shape.slug })
      .safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const { slug, ...body } = parsed.data;
    const res = await authedServerFetch(`/admin/event-rsvps/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      return actionFailure(payload.error ?? "Could not update event");
    }
    return actionSuccess({ slug });
  });
}
