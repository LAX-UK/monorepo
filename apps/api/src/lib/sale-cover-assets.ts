import {
  effectiveCoverSide,
  resolveCoverSlotSources,
  slotScrimSettings,
  suggestCoverSide,
} from "@auction/domain";
import type { CoverAnalysisRecord, MediaAssetRecord } from "@auction/persistence/interfaces";
import {
  SALE_COVER_SLOT_NAMES,
  type Sale,
  type SaleCoverSlot,
  type SaleCoverSlotAsset,
  type SaleCoverSlotAssets,
  type SaleCoverSlotName,
} from "@auction/types";

/** Every storage key the sale's cover slots point at: stored slots, and the old array for the rest. */
export function collectCoverSlotKeys(sale: Pick<Sale, "coverSlots" | "coverImages">): string[] {
  const sources = resolveCoverSlotSources(sale.coverSlots, sale.coverImages);
  const keys: string[] = [];
  for (const source of Object.values(sources)) {
    if (!source) continue;
    if (source.kind === "legacy") keys.push(source.key);
    else keys.push(source.slot.fromLot?.imageKey ?? source.slot.key ?? "");
  }
  return keys.filter(Boolean);
}

/** The fingerprints of the stored slots, to look their measured analysis up by. */
export function collectCoverAnalysisHashes(sale: Pick<Sale, "coverSlots">): string[] {
  return SALE_COVER_SLOT_NAMES.flatMap((name) => {
    const hash = sale.coverSlots?.[name]?.analysisHash;
    return hash ? [hash] : [];
  });
}

export type CoverAssetLookups = {
  /** The stored size and blur preview of a picture, by the key the sale holds. */
  media: (key: string) => Pick<MediaAssetRecord, "width" | "height" | "blurDataURL"> | undefined;
  analysis: (hash: string) => CoverAnalysisRecord | undefined;
  /** The public address of a stored picture. */
  resolve: (key: string) => string;
};

function presentStoredSlot(
  name: SaleCoverSlotName,
  slot: SaleCoverSlot,
  lookups: CoverAssetLookups,
): SaleCoverSlotAsset {
  const key = slot.fromLot?.imageKey ?? slot.key ?? "";
  const record = lookups.analysis(slot.analysisHash);
  const ready = record?.status === "ready" ? record.analysis : null;
  const blurDataURL = ready?.blurDataURL ?? lookups.media(key)?.blurDataURL;
  return {
    src: lookups.resolve(key),
    width: slot.width,
    height: slot.height,
    ...(blurDataURL ? { blurDataURL } : {}),
    focal: slot.focal,
    ...(slot.keep ? { keep: slot.keep } : {}),
    zoom: slot.zoom,
    alt: slot.alt,
    ...(slot.fromLot ? { lotId: slot.fromLot.lotId } : {}),
    side: effectiveCoverSide(slot),
    analysisStatus: record ? record.status : "pending",
    colours: ready
      ? { dominant: ready.dominant, deepest: ready.deepest, field: ready.field }
      : null,
    scrim: ready ? slotScrimSettings(name, slot, ready) : {},
  };
}

/** A picture from the old array: centred, with the alt text the page always generated. */
function presentLegacySlot(
  key: string,
  title: string,
  lookups: CoverAssetLookups,
): SaleCoverSlotAsset | null {
  const meta = lookups.media(key);
  if (!meta) return null;
  const focal = { x: 0.5, y: 0.5 };
  return {
    src: lookups.resolve(key),
    width: meta.width,
    height: meta.height,
    blurDataURL: meta.blurDataURL,
    focal,
    zoom: 1,
    alt: `${title} — auction cover`,
    side: suggestCoverSide(focal),
    analysisStatus: "pending",
    colours: null,
    scrim: {},
  };
}

/**
 * The cover slots as the public reads return them: resolved addresses, sizes and, when the worker
 * has measured the picture, its colours and the scrim to paint. A slot staff have not set is read
 * from its position in the old array, so existing sales keep their covers.
 */
export function buildSaleCoverSlotAssets(
  sale: Pick<Sale, "title" | "coverSlots" | "coverImages">,
  lookups: CoverAssetLookups,
): SaleCoverSlotAssets | undefined {
  const sources = resolveCoverSlotSources(sale.coverSlots, sale.coverImages);
  const out: SaleCoverSlotAssets = {};
  for (const name of SALE_COVER_SLOT_NAMES) {
    const source = sources[name];
    if (!source) continue;
    const asset =
      source.kind === "slot"
        ? presentStoredSlot(name, source.slot, lookups)
        : presentLegacySlot(source.key, sale.title, lookups);
    if (asset) out[name] = asset;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
