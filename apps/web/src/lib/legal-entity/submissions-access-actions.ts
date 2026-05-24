"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import { revalidatePath } from "next/cache";

/** Clears the acting-entity cookie so API calls fall back to the personal profile. */
export async function usePersonalProfileForSubmissions(): Promise<void> {
  return instrumentServerAction("usePersonalProfileForSubmissions", async () => {
    await switchActingLegalEntity(null);
    revalidatePath("/dashboard/seller");
    revalidatePath("/dashboard/submissions");
    revalidatePath("/dashboard");
  });
}
