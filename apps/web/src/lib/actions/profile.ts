"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function errMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

export async function updateProfileNameAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/dashboard/settings/profile?error=Name+required");
  const res = await authedServerFetch("/users/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(
      `/dashboard/settings/profile?error=${encodeURIComponent(errMessage(body, "Update failed"))}`,
    );
  }
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard");
  redirect("/dashboard/settings/profile");
}

export async function createAddressAction(formData: FormData): Promise<void> {
  const label = String(formData.get("label") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  if (!label || !line1 || !city || !postalCode || !country) {
    redirect("/dashboard/settings/profile?error=Fill+required+address+fields");
  }
  const line2 = String(formData.get("line2") ?? "").trim() || undefined;
  const state = String(formData.get("state") ?? "").trim() || undefined;
  const res = await authedServerFetch("/users/me/addresses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault: formData.get("isDefault") === "on",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(
      `/dashboard/settings/profile?error=${encodeURIComponent(errMessage(body, "Address failed"))}`,
    );
  }
  revalidatePath("/dashboard/settings/profile");
  redirect("/dashboard/settings/profile");
}
