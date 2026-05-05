"use server";

import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import {
  createAddressBodySchema,
  updateAddressBodySchema,
  updateProfileNameFormSchema,
  updateProfileSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createAddressWithDefaultSchema = createAddressBodySchema.extend({
  isDefault: z.boolean().optional(),
});

export async function updateProfileNameFromValuesAction(input: {
  name: string;
}): Promise<ActionResult<void>> {
  const parsed = updateProfileNameFormSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { profile } = getWriteContainer();
  const r = await profile.updateProfile({ name: parsed.data.name });
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard");
  return actionSuccess();
}

export async function updateProfileImageAction(input: {
  image: string | null;
}): Promise<ActionResult<void>> {
  const parsed = updateProfileSchema.pick({ image: true }).required().safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { profile } = getWriteContainer();
  const r = await profile.updateProfile({ image: parsed.data.image });
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard");
  return actionSuccess();
}

export async function createAddressFromValuesAction(
  input: z.infer<typeof createAddressWithDefaultSchema>,
): Promise<ActionResult<void>> {
  const parsed = createAddressWithDefaultSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const d = parsed.data;
  const { profile } = getWriteContainer();
  const r = await profile.createAddress({
    label: d.label,
    line1: d.line1,
    line2: d.line2,
    city: d.city,
    state: d.state,
    postalCode: d.postalCode,
    country: d.country,
    isDefault: d.isDefault ?? false,
  });
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard/settings/addresses");
  return actionSuccess();
}

export async function updateAddressFromValuesAction(
  id: string,
  input: z.infer<typeof updateAddressBodySchema>,
): Promise<ActionResult<void>> {
  const addressId = id.trim();
  if (!addressId) return actionFailure("Missing address");
  const parsed = updateAddressBodySchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { profile } = getWriteContainer();
  const r = await profile.updateAddress(addressId, parsed.data);
  if (!r.ok) return actionFailure(r.message, undefined, r.status);
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard/settings/addresses");
  return actionSuccess();
}

export async function removeAddressAction(id: string): Promise<ActionResult<void>> {
  const addressId = id.trim();
  if (!addressId) return actionFailure("Missing address");
  const { profile } = getWriteContainer();
  const r = await profile.removeAddress(addressId);
  if (!r.ok) return actionFailure(r.message, undefined, r.status);
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard/settings/addresses");
  return actionSuccess();
}

export async function setDefaultAddressAction(id: string): Promise<ActionResult<void>> {
  const addressId = id.trim();
  if (!addressId) return actionFailure("Missing address");
  const { profile } = getWriteContainer();
  const r = await profile.setDefaultAddress(addressId);
  if (!r.ok) return actionFailure(r.message, undefined, r.status);
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard/settings/addresses");
  return actionSuccess();
}

export async function updateProfileNameAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const parsed = updateProfileNameFormSchema.safeParse({ name });
  if (!parsed.success) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard/settings/profile?error=Name+required");
    return;
  }
  const { profile } = getWriteContainer();
  const r = await profile.updateProfile({ name: parsed.data.name });
  if (!r.ok) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/settings/profile?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard/settings/addresses");
  revalidatePath("/dashboard");
  const { redirect } = await import("next/navigation");
  redirect("/dashboard/settings/profile");
}

export async function createAddressAction(formData: FormData): Promise<void> {
  const raw = {
    label: String(formData.get("label") ?? "").trim(),
    line1: String(formData.get("line1") ?? "").trim(),
    line2: String(formData.get("line2") ?? "").trim() || undefined,
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim() || undefined,
    postalCode: String(formData.get("postalCode") ?? "").trim(),
    country: String(formData.get("country") ?? "").trim(),
    isDefault: formData.get("isDefault") === "on",
  };
  const parsed = createAddressWithDefaultSchema.safeParse(raw);
  if (!parsed.success) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard/settings/profile?error=Fill+required+address+fields");
    return;
  }
  const d = parsed.data;
  const { profile } = getWriteContainer();
  const r = await profile.createAddress({
    label: d.label,
    line1: d.line1,
    line2: d.line2,
    city: d.city,
    state: d.state,
    postalCode: d.postalCode,
    country: d.country,
    isDefault: d.isDefault ?? false,
  });
  if (!r.ok) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/settings/profile?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/dashboard/settings/profile");
  const { redirect } = await import("next/navigation");
  redirect("/dashboard/settings/profile");
}
