import { saleDeliveryModes } from "@auction/types";
import { createSaleSchema, updateSaleSchema } from "@auction/validators";
import { z } from "zod";

function splitUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCategoryId(cat: string): string | undefined {
  const t = cat.trim();
  if (!t || !/^[0-9a-f-]{36}$/i.test(t)) return undefined;
  return t;
}

export const adminSaleFormValuesSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10_000),
  coverImages: z.string(),
  categoryId: z.string(),
  deliveryMode: z.enum(saleDeliveryModes),
  streamUrl: z.string().max(500),
  startTime: z.string().min(1, "Start is required"),
  endTime: z.string().min(1, "End is required"),
  previewStartTime: z.string(),
  buyerPremiumRate: z.string(),
  terms: z.string().max(50_000),
});

export type AdminSaleFormValues = z.infer<typeof adminSaleFormValuesSchema>;

export function safeParseCreateSaleFromForm(values: AdminSaleFormValues) {
  const coverRaw = values.coverImages.trim();
  return createSaleSchema.safeParse({
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    coverImages: coverRaw ? splitUrlLines(coverRaw) : undefined,
    categoryId: parseCategoryId(values.categoryId),
    deliveryMode: values.deliveryMode,
    streamUrl: values.streamUrl.trim() || undefined,
    startTime: new Date(values.startTime),
    endTime: new Date(values.endTime),
    previewStartTime: values.previewStartTime.trim()
      ? new Date(values.previewStartTime)
      : undefined,
    buyerPremiumRate: values.buyerPremiumRate.trim() || undefined,
    terms: values.terms.trim() || undefined,
  });
}

export function safeParseUpdateSaleFromForm(values: AdminSaleFormValues) {
  const coverRaw = values.coverImages.trim();
  const streamRaw = values.streamUrl.trim();
  return updateSaleSchema.safeParse({
    title: values.title.trim() || undefined,
    description: values.description.trim() || undefined,
    coverImages: coverRaw ? splitUrlLines(coverRaw) : undefined,
    categoryId: parseCategoryId(values.categoryId),
    deliveryMode: values.deliveryMode,
    streamUrl: streamRaw === "" ? null : streamRaw || undefined,
    startTime: values.startTime.trim() ? new Date(values.startTime) : undefined,
    endTime: values.endTime.trim() ? new Date(values.endTime) : undefined,
    previewStartTime: values.previewStartTime.trim()
      ? new Date(values.previewStartTime)
      : undefined,
    buyerPremiumRate: values.buyerPremiumRate.trim() || undefined,
    terms: values.terms.trim() || undefined,
  });
}
