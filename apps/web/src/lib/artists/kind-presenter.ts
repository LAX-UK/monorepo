import type { ArtistKind, ArtistStatus } from "@auction/types";

/** Presentation metadata for an `ArtistKind`. New kinds plug in by adding a
 * single entry — components do not branch on the enum. (OCP) */
export type ArtistKindMeta = {
  label: string;
  /** Short label used inside chips/badges (typically the same word). */
  badge: string;
  /** One-sentence description for help text. */
  description: string;
};

const META: Record<ArtistKind, ArtistKindMeta> = {
  artist: {
    label: "Artist",
    badge: "Artist",
    description: "A named human creator (painter, sculptor, photographer).",
  },
  maker: {
    label: "Maker",
    badge: "Maker",
    description: "A craftsperson, atelier or studio (furniture, ceramics, watchmaking).",
  },
  brand: {
    label: "Brand",
    badge: "Brand",
    description: "A commercial brand or house (Hermès, Cartier).",
  },
  marque: {
    label: "Marque",
    badge: "Marque",
    description: "A vehicle or luxury-goods marque (Ferrari, Patek Philippe).",
  },
};

export function artistKindMeta(kind: ArtistKind): ArtistKindMeta {
  return META[kind];
}

export const ARTIST_KIND_OPTIONS: ReadonlyArray<{ value: ArtistKind; label: string }> = (
  Object.keys(META) as ArtistKind[]
).map((value) => ({ value, label: META[value].label }));

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
