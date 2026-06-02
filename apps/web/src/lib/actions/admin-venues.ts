"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { VENUES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { CreateVenueInput, UpdateVenueInput } from "@auction/types";
import { createVenueSchema, updateVenueSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

function revalidateVenuePaths(venueId?: string): void {
  revalidatePath("/admin/venues");
  if (venueId) {
    revalidatePath(`/admin/venues/${venueId}`);
    revalidatePath(`/admin/venues/${venueId}/edit`);
  }
}

function venueErrorMessage(message: string, code?: string): string {
  if (code === "venue_in_use") {
    return "This venue is referenced by existing sales and its organisation cannot be changed. Archive or detach it from all sales first.";
  }
  if (code === "venue_org_mismatch") {
    return "This venue belongs to a different organisation than the sale operator. Venues can only be used by sales operated by the same legal entity.";
  }
  if (code === "venue_not_found") return "Venue not found.";
  if (code === "venue_slug_conflict") return "Could not generate a unique venue slug.";
  return message;
}

export async function adminCreateVenueResultAction(
  input: CreateVenueInput,
): Promise<ActionResult<{ id: string }>> {
  return instrumentServerAction("adminCreateVenueResultAction", async () => {
    const denied = await denyUnlessAdminCapability(VENUES_ACCESS);
    if (denied) return denied;
    const parsed = createVenueSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const r = await getWriteContainer().adminVenues.create(parsed.data);
    if (!r.ok) {
      return actionFailure(venueErrorMessage(r.message, r.code), undefined, r.status, r.code);
    }
    revalidateVenuePaths(r.data.id);
    return actionSuccess({ id: r.data.id });
  });
}

export async function adminUpdateVenueResultAction(
  id: string,
  input: UpdateVenueInput,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateVenueResultAction", async () => {
    const denied = await denyUnlessAdminCapability(VENUES_ACCESS);
    if (denied) return denied;
    const venueId = id.trim();
    if (!venueId) return actionFailure("Missing venue");
    const parsed = updateVenueSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const r = await getWriteContainer().adminVenues.update(venueId, parsed.data);
    if (!r.ok) {
      return actionFailure(venueErrorMessage(r.message, r.code), undefined, r.status, r.code);
    }
    revalidateVenuePaths(venueId);
    return actionSuccess();
  });
}

export async function adminArchiveVenueResultAction(id: string): Promise<ActionResult<void>> {
  return instrumentServerAction("adminArchiveVenueResultAction", async () => {
    const denied = await denyUnlessAdminCapability(VENUES_ACCESS);
    if (denied) return denied;
    const venueId = id.trim();
    if (!venueId) return actionFailure("Missing venue");
    const r = await getWriteContainer().adminVenues.archive(venueId);
    if (!r.ok) {
      return actionFailure(venueErrorMessage(r.message, r.code), undefined, r.status, r.code);
    }
    revalidateVenuePaths(venueId);
    return actionSuccess();
  });
}
