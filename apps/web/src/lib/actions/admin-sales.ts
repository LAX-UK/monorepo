"use server";

import { authedJsonRedirect } from "@/lib/actions/_helpers";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { createSaleSchema, updateSaleSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function splitUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function adminCreateSaleAction(formData: FormData): Promise<void> {
  const coverRaw = String(formData.get("coverImages") ?? "");
  const cat = String(formData.get("categoryId") ?? "").trim();
  const dmRaw = String(formData.get("deliveryMode") ?? "onsite").trim();
  const deliveryMode =
    dmRaw === "online" || dmRaw === "onsite" || dmRaw === "hybrid" ? dmRaw : "onsite";
  const streamRaw = String(formData.get("streamUrl") ?? "").trim();
  const parsed = createSaleSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    coverImages: coverRaw ? splitUrlLines(coverRaw) : undefined,
    categoryId: cat && /^[0-9a-f-]{36}$/i.test(cat) ? cat : undefined,
    deliveryMode,
    streamUrl: streamRaw || undefined,
    startTime: new Date(String(formData.get("startTime") ?? "")),
    endTime: new Date(String(formData.get("endTime") ?? "")),
    previewStartTime: String(formData.get("previewStartTime") ?? "").trim()
      ? new Date(String(formData.get("previewStartTime")))
      : undefined,
    buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
    terms: String(formData.get("terms") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/admin/sales/new?error=${encodeURIComponent(parsed.error.issues.map((e: { message: string }) => e.message).join("; "))}`,
    );
  }
  const res = await authedServerFetch("/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(
      `/admin/sales/new?error=${encodeURIComponent(String((body as { error?: string }).error ?? "Create failed"))}`,
    );
  }
  const id = String((body as { data?: { id?: string } }).data?.id ?? "");
  revalidatePath("/admin/sales");
  revalidatePath("/");
  if (id) redirect(`/admin/sales/${id}`);
  redirect("/admin/sales");
}

export async function adminUpdateSaleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("saleId") ?? "").trim();
  if (!id) redirect(`/admin/sales?error=${encodeURIComponent("Missing sale")}`);
  const coverRaw = String(formData.get("coverImages") ?? "");
  const cat = String(formData.get("categoryId") ?? "").trim();
  const dmRaw = String(formData.get("deliveryMode") ?? "").trim();
  const deliveryMode =
    dmRaw === "online" || dmRaw === "onsite" || dmRaw === "hybrid" ? dmRaw : undefined;
  const streamRaw = String(formData.get("streamUrl") ?? "").trim();
  const parsed = updateSaleSchema.safeParse({
    title: String(formData.get("title") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    coverImages: coverRaw ? splitUrlLines(coverRaw) : undefined,
    categoryId: cat && /^[0-9a-f-]{36}$/i.test(cat) ? cat : undefined,
    deliveryMode,
    streamUrl: streamRaw === "" ? null : streamRaw || undefined,
    startTime: String(formData.get("startTime") ?? "").trim()
      ? new Date(String(formData.get("startTime")))
      : undefined,
    endTime: String(formData.get("endTime") ?? "").trim()
      ? new Date(String(formData.get("endTime")))
      : undefined,
    previewStartTime: String(formData.get("previewStartTime") ?? "").trim()
      ? new Date(String(formData.get("previewStartTime")))
      : undefined,
    buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
    terms: String(formData.get("terms") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    redirect(
      `/admin/sales/${id}/edit?error=${encodeURIComponent(parsed.error.issues.map((e: { message: string }) => e.message).join("; "))}`,
    );
  }
  await authedJsonRedirect({
    path: `/sales/${encodeURIComponent(id)}`,
    method: "PATCH",
    json: parsed.data,
    okRedirect: `/admin/sales/${id}`,
    errRedirect: `/admin/sales/${id}/edit`,
    revalidatePaths: ["/admin/sales", `/admin/sales/${id}`, "/"],
  });
}

export async function adminPublishSaleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("saleId") ?? "").trim();
  if (!id) redirect(`/admin/sales?error=${encodeURIComponent("Missing sale")}`);
  await authedJsonRedirect({
    path: `/sales/${encodeURIComponent(id)}/publish`,
    method: "POST",
    okRedirect: `/admin/sales/${id}`,
    errRedirect: `/admin/sales/${id}`,
    revalidatePaths: ["/admin/sales", `/admin/sales/${id}`, "/"],
  });
}

export async function adminCancelSaleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("saleId") ?? "").trim();
  if (!id) redirect(`/admin/sales?error=${encodeURIComponent("Missing sale")}`);
  await authedJsonRedirect({
    path: `/sales/${encodeURIComponent(id)}/cancel`,
    method: "POST",
    json: {},
    okRedirect: `/admin/sales/${id}`,
    errRedirect: `/admin/sales/${id}`,
    revalidatePaths: ["/admin/sales", `/admin/sales/${id}`, "/"],
  });
}

export async function adminAttachLotToSaleAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get("saleId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  if (!saleId || !lotId)
    redirect(`/admin/sales?error=${encodeURIComponent("Missing sale or lot")}`);
  await authedJsonRedirect({
    path: `/sales/${encodeURIComponent(saleId)}/lots/attach/${encodeURIComponent(lotId)}`,
    method: "POST",
    okRedirect: `/admin/sales/${saleId}`,
    errRedirect: `/admin/sales/${saleId}`,
    revalidatePaths: ["/admin/sales", `/admin/sales/${saleId}`, "/admin/lots"],
  });
}

export async function adminDetachLotFromSaleAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get("saleId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  if (!saleId || !lotId)
    redirect(`/admin/sales?error=${encodeURIComponent("Missing sale or lot")}`);
  const res = await authedServerFetch(
    `/sales/${encodeURIComponent(saleId)}/lots/${encodeURIComponent(lotId)}`,
    { method: "DELETE" },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(
      `/admin/sales/${saleId}?error=${encodeURIComponent(String((body as { error?: string }).error ?? "Detach failed"))}`,
    );
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${saleId}`);
  revalidatePath("/admin/lots");
  redirect(`/admin/sales/${saleId}`);
}
