import {
  type ArtistKind,
  type ArtistStatus,
  CREATOR_KIND_CONFIG,
  artistKinds,
} from "@auction/types";

/** Presentation metadata for an `ArtistKind`. Derived from the shared
 * {@link CREATOR_KIND_CONFIG} so new kinds plug in by adding a single config
 * entry — components do not branch on the enum. (OCP) */
export type ArtistKindMeta = {
  label: string;
  /** Short label used inside chips/badges (typically the same word). */
  badge: string;
  /** One-sentence description for help text. */
  description: string;
};

/** Human help-text descriptions per kind. Falls back to a department hint
 * when a specific description is not provided. */
const DESCRIPTIONS: Partial<Record<ArtistKind, string>> = {
  artist: "A named human creator (painter, sculptor, photographer).",
  maker: "A craftsperson, atelier or studio (furniture, ceramics, watchmaking).",
  designer: "A named designer (furniture, industrial, graphic).",
  studio: "A studio or workshop producing collaborative work.",
  brand: "A commercial brand or house (Hermès, Cartier).",
  marque: "A vehicle or luxury-goods marque (Ferrari, Patek Philippe).",
  manufacturer: "A manufacturing company (watches, instruments, machinery).",
  coachbuilder: "A coachbuilder who bodies or finishes vehicles.",
  author: "A writer attributed to books and manuscripts.",
  publisher: "A publishing house issuing printed works.",
  printer: "A printer or private press.",
  mint: "A mint that strikes coins and medals.",
  issuing_authority: "An issuing authority (monarch, state, central bank).",
  producer: "A named producer or estate behind collectible objects.",
};

const META: Record<ArtistKind, ArtistKindMeta> = Object.fromEntries(
  artistKinds.map((kind) => {
    const config = CREATOR_KIND_CONFIG[kind];
    return [
      kind,
      {
        label: config.label,
        badge: config.label,
        description: DESCRIPTIONS[kind] ?? config.departmentHints[0] ?? config.label,
      },
    ];
  }),
) as Record<ArtistKind, ArtistKindMeta>;

export function artistKindMeta(kind: ArtistKind): ArtistKindMeta {
  return META[kind] ?? META.artist;
}

export const ARTIST_KIND_OPTIONS: ReadonlyArray<{ value: ArtistKind; label: string }> =
  artistKinds.map((value) => ({ value, label: META[value].label }));

/** Status presentation. Mostly a label + a tone hint the badge component can map to its variants. */
export function artistStatusLabel(status: ArtistStatus): {
  label: string;
  tone: "info" | "success" | "warning" | "danger" | "muted";
} {
  switch (status) {
    case "approved":
      return { label: "Approved", tone: "success" };
    case "pending":
      return { label: "Pending review", tone: "warning" };
    case "rejected":
      return { label: "Rejected", tone: "danger" };
    case "merged_into":
      return { label: "Merged", tone: "muted" };
    default:
      return { label: status, tone: "info" };
  }
}
