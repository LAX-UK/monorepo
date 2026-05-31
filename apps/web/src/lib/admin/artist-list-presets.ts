import { buildListHref } from "@/lib/admin/admin-list-params";

export type ArtistPresetId =
  | "all"
  | "pending"
  | "makers"
  | "historical"
  | "brands"
  | "featured"
  | "archived";

const PRESET_BASE = "/admin/artists";

const queueClearPatch = {
  backfill: null,
  duplicates: null,
};

/** Preset tabs: each maps to a stable filter URL (OCP-friendly table). */
export function artistListPresetHref(
  id: ArtistPresetId,
  current: Record<string, string | string[] | undefined>,
): string {
  switch (id) {
    case "all":
      return buildListHref(PRESET_BASE, current, {
        ...queueClearPatch,
        status: null,
        kinds: null,
        kind: null,
        linked: null,
        featured: null,
        verified: null,
        archivedOnly: null,
        includeArchived: null,
        offset: 0,
      });
    case "pending":
      return buildListHref(PRESET_BASE, current, {
        ...queueClearPatch,
        status: "pending",
        offset: 0,
        kinds: null,
        kind: null,
        linked: null,
        featured: null,
        verified: null,
        archivedOnly: null,
        includeArchived: null,
      });
    case "makers":
      return buildListHref(PRESET_BASE, current, {
        ...queueClearPatch,
        linked: "yes",
        status: null,
        kinds: null,
        kind: null,
        offset: 0,
      });
    case "historical":
      return buildListHref(PRESET_BASE, current, {
        ...queueClearPatch,
        linked: "no",
        kinds: "artist,maker",
        status: null,
        kind: null,
        offset: 0,
      });
    case "brands":
      return buildListHref(PRESET_BASE, current, {
        ...queueClearPatch,
        kinds: "brand,marque",
        linked: null,
        status: null,
        kind: null,
        offset: 0,
      });
    case "featured":
      return buildListHref(PRESET_BASE, current, {
        ...queueClearPatch,
        featured: true,
        offset: 0,
        status: null,
        kinds: null,
        kind: null,
      });
    case "archived":
      return buildListHref(PRESET_BASE, current, {
        ...queueClearPatch,
        archivedOnly: true,
        includeArchived: true,
        offset: 0,
      });
    default:
      return buildListHref(PRESET_BASE, current, { ...queueClearPatch, offset: 0 });
  }
}

export function artistListActivePreset(
  q: Record<string, string | string[] | undefined>,
): ArtistPresetId {
  const str = (k: string) => {
    const v = q[k];
    return String(Array.isArray(v) ? v[0] : (v ?? ""));
  };
  if (str("archivedOnly") === "true") return "archived";
  const fe = str("featured");
  if (fe === "true" || fe === "1") return "featured";
  const kinds = str("kinds");
  if (kinds.includes("brand") || kinds.includes("marque")) return "brands";
  if (kinds.includes("artist") && kinds.includes("maker")) return "historical";
  if (str("linked") === "yes") return "makers";
  if (str("status") === "pending") return "pending";
  return "all";
}
