import { type ArtistKind, getCreatorKindConfig } from "@auction/types";

export function visualArtistJsonLd(opts: {
  name: string;
  url: string;
  image?: string;
  description?: string;
  sameAs?: string[];
  /** YYYY (or YYYY-MM-DD) string from the registry. */
  birthDate?: string;
  deathDate?: string;
  nationality?: string;
  /** Aliases / akas surfaced as `alternateName`. */
  alternateName?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["Person", "VisualArtist"],
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
    ...(opts.birthDate ? { birthDate: opts.birthDate } : {}),
    ...(opts.deathDate ? { deathDate: opts.deathDate } : {}),
    ...(opts.nationality ? { nationality: opts.nationality } : {}),
    ...(opts.alternateName && opts.alternateName.length > 0
      ? { alternateName: opts.alternateName }
      : {}),
  };
}

/** `Brand` / `Organization` JSON-LD for catalogue brand or marque entities. */
export function brandOrOrganizationJsonLd(opts: {
  type: "Brand" | "Organization";
  name: string;
  url: string;
  image?: string;
  description?: string;
  sameAs?: string[];
  alternateName?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type,
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
    ...(opts.alternateName && opts.alternateName.length > 0
      ? { alternateName: opts.alternateName }
      : {}),
  };
}

/**
 * Kind-driven creator JSON-LD. The schema.org `@type` is selected from the
 * creator-kind config registry (OCP): adding a new kind only updates the
 * registry, never this function. Person-like kinds carry lifespan/nationality;
 * organisation-like kinds emit a Brand/Organization node.
 */
export function creatorJsonLd(opts: {
  kind: ArtistKind | null | undefined;
  name: string;
  url: string;
  image?: string;
  description?: string;
  sameAs?: string[];
  alternateName?: string[];
  birthDate?: string;
  deathDate?: string;
  foundingDate?: string;
  dissolutionDate?: string;
  nationality?: string;
}): Record<string, unknown> {
  const config = getCreatorKindConfig(opts.kind);
  const isPerson = config.lifespanMode === "person";
  // "Manufacturer" is not a standalone schema.org type; fall back to Organization
  // and keep the richer label as `additionalType`.
  const type =
    config.schemaOrgType === "VisualArtist"
      ? ["Person", "VisualArtist"]
      : config.schemaOrgType === "Manufacturer"
        ? "Organization"
        : config.schemaOrgType;
  const additionalType =
    config.schemaOrgType === "Manufacturer" ? "https://schema.org/Manufacturer" : undefined;
  return {
    "@context": "https://schema.org",
    "@type": type,
    ...(additionalType ? { additionalType } : {}),
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
    ...(opts.alternateName && opts.alternateName.length > 0
      ? { alternateName: opts.alternateName }
      : {}),
    ...(isPerson && opts.birthDate ? { birthDate: opts.birthDate } : {}),
    ...(isPerson && opts.deathDate ? { deathDate: opts.deathDate } : {}),
    ...(isPerson && opts.nationality ? { nationality: opts.nationality } : {}),
    ...(!isPerson && opts.foundingDate ? { foundingDate: opts.foundingDate } : {}),
    ...(!isPerson && opts.dissolutionDate ? { dissolutionDate: opts.dissolutionDate } : {}),
  };
}
