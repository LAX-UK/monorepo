import {
  SALE_COVER_SLOT_NAMES,
  type SaleCoverSlotAsset,
  type SaleCoverSlotAssets,
} from "@auction/types";
import { z } from "zod";

const unit = z.number().min(0).max(1);
const point = z.object({ x: unit, y: unit });
const rect = z.object({ x: unit, y: unit, width: unit, height: unit });
const scrim = z.object({
  tone: z.enum(["light", "dark"]),
  strength: z.number().min(0).max(1),
  creditBand: z.number().min(0).max(1),
});

const slotAssetSchema = z.object({
  src: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  blurDataURL: z.string().optional(),
  focal: point,
  keep: rect.optional(),
  zoom: z.number().min(1).max(2.5),
  alt: z.string(),
  lotId: z.string().optional(),
  side: z.enum(["left", "right"]),
  analysisStatus: z.enum(["pending", "ready", "failed"]),
  colours: z.object({ dominant: z.string(), deepest: z.string(), field: z.string() }).nullable(),
  scrim: z.object({ desktop: scrim.nullish(), wide: scrim.nullish() }),
});

/**
 * The cover slots as the public sale reads return them. A slot that does not match is left out,
 * so one bad slot never takes the cover down: the cover then falls to its next source.
 */
export function parseSaleCoverSlotAssets(raw: unknown): SaleCoverSlotAssets | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const source = raw as Record<string, unknown>;
  const out: SaleCoverSlotAssets = {};
  for (const name of SALE_COVER_SLOT_NAMES) {
    const parsed = slotAssetSchema.safeParse(source[name]);
    if (parsed.success) out[name] = parsed.data as SaleCoverSlotAsset;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
