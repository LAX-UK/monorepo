import type {
  AdminArtworkLookupItem,
  AdminClientDetail,
  AdminEditionLookupItem,
  AdminPartyLookupItem,
} from "@auction/shop-contracts";

/*
 * How the records staff pick in forms (a person, an artwork, an edition) read in a picker: the
 * name they know it by, a second line that tells similar records apart, and a status where one
 * matters. Plain data, so it can cross from a server action to the picker unchanged.
 */

export type LookupOption = {
  id: string;
  label: string;
  description?: string;
  meta?: string;
};

export const EDITION_LISTING_LABELS: Record<string, string> = {
  not_authorised: "Not authorised",
  authorised: "Available",
  reserved: "Reserved",
  held: "Held",
  sold: "Sold",
  withdrawn: "Withdrawn",
};

const PARTY_KIND_LABELS: Record<string, string> = {
  person: "Person",
  gallery: "Gallery",
  artist: "Artist",
  broker: "Broker",
  marketplace: "Marketplace",
  lax: "LAX",
};

export function editionListingLabel(status: string): string {
  return EDITION_LISTING_LABELS[status] ?? status.replace(/_/g, " ");
}

export function partyKindLabel(kind: string): string {
  return PARTY_KIND_LABELS[kind] ?? kind;
}

/** A person by name, with their email, which tells two people of the same name apart. */
export function partyOption(item: AdminPartyLookupItem): LookupOption {
  return {
    id: item.partyId,
    label: item.displayName,
    description: item.email ?? partyKindLabel(item.kind),
    ...(item.email ? { meta: partyKindLabel(item.kind) } : {}),
  };
}

export function artworkOption(item: AdminArtworkLookupItem): LookupOption {
  return { id: item.artworkId, label: item.title, description: item.artistName };
}

export function editionLabel(item: { artworkTitle: string; editionNumber: number }): string {
  return `${item.artworkTitle}, edition ${item.editionNumber}`;
}

export function editionOption(item: AdminEditionLookupItem): LookupOption {
  return {
    id: item.editionId,
    label: editionLabel(item),
    description: item.artistName,
    meta: editionListingLabel(item.listingStatus),
  };
}

/**
 * The artworks a client already holds editions of, one option per artwork (a client with two
 * editions of the same work is offered the work once), with which editions they hold.
 */
export function ownedArtworkOptions(editions: AdminClientDetail["editions"]): LookupOption[] {
  const byArtwork = new Map<string, { title: string; numbers: number[] }>();
  for (const edition of editions) {
    const entry = byArtwork.get(edition.artworkId) ?? { title: edition.artworkTitle, numbers: [] };
    entry.numbers.push(edition.editionNumber);
    byArtwork.set(edition.artworkId, entry);
  }
  return [...byArtwork.entries()].map(([artworkId, entry]) => {
    const numbers = [...entry.numbers].sort((a, b) => a - b);
    return {
      id: artworkId,
      label: entry.title,
      description: `Holds ${numbers.length === 1 ? "edition" : "editions"} ${numbers.join(", ")}`,
    };
  });
}
