import { artistKindMeta } from "@/lib/artists/kind-presenter";
import type { ArtistKind } from "@auction/types";
import { Badge } from "@auction/ui";

/** A single classification chip for an artist profile. The visual is one of:
 * - Featured / Verified flags (highest prominence)
 * - Living vs Historical (computed from death year)
 * - Brand / Marque (taxonomy)
 *
 * Renders nothing for the "neutral" artist case so callers can drop it in
 * unconditionally and only get visual noise when there's something to say.
 */
export type ArtistScenarioBadgeProps = {
  kind?: ArtistKind | null | undefined;
  featured?: boolean | null | undefined;
  verified?: boolean | null | undefined;
  /** Death year string from the registry; presence indicates Historical. */
  deathYear?: string | null | undefined;
  /** Set of badges to render (default: all). Lets pages opt-out of e.g. Featured
   * when it's already in the page chrome. */
  show?: ReadonlyArray<"featured" | "verified" | "kind" | "lifespan">;
  className?: string;
};

const ALL_SHOW: ReadonlyArray<"featured" | "verified" | "kind" | "lifespan"> = [
  "featured",
  "verified",
  "kind",
  "lifespan",
];

export function ArtistScenarioBadges({
  kind,
  featured,
  verified,
  deathYear,
  show = ALL_SHOW,
  className,
}: ArtistScenarioBadgeProps) {
  const allow = new Set(show);
  const isHistorical = Boolean(deathYear?.trim());
  const kindMeta = kind ? artistKindMeta(kind) : null;
  const showKindBadge =
    allow.has("kind") && kindMeta && (kind === "brand" || kind === "marque" || kind === "maker");

  return (
    <div className={["flex flex-wrap items-center gap-1.5", className].filter(Boolean).join(" ")}>
      {allow.has("featured") && featured ? <Badge>Featured</Badge> : null}
      {allow.has("verified") && verified ? <Badge variant="secondary">Verified</Badge> : null}
      {allow.has("lifespan") && (kind === "artist" || kind === "maker" || kind == null) ? (
        <Badge variant="outline">{isHistorical ? "Historical" : "Living"}</Badge>
      ) : null}
      {showKindBadge && kindMeta ? <Badge variant="secondary">{kindMeta.badge}</Badge> : null}
    </div>
  );
}
