import type { AdminEnquiryDetail } from "@auction/shop-contracts";

export type EnquiryContextLink = { label: string; href: string | null; text: string };

function origin(artPublicUrl: string | null): string | null {
  const trimmed = artPublicUrl?.trim().replace(/\/+$/, "");
  return trimmed || null;
}

/**
 * Where the enquiry came from, with a link to the public lax.art page when we know its address.
 * Only artworks and exhibitions have a page we can name from the slug alone; other contexts
 * (an artist, a venue) are shown as plain text rather than a guessed link.
 */
export function enquiryContextLinks(
  detail: Pick<AdminEnquiryDetail, "artwork" | "contextSlug" | "topic">,
  artPublicUrl: string | null,
): EnquiryContextLink[] {
  const base = origin(artPublicUrl);
  const links: EnquiryContextLink[] = [];
  if (detail.artwork) {
    links.push({
      label: "Artwork",
      text: detail.artwork.title,
      href: base ? `${base}/artworks/${encodeURIComponent(detail.artwork.slug)}` : null,
    });
  }
  if (detail.contextSlug) {
    links.push({
      label: detail.topic === "exhibition" ? "Exhibition" : "Page",
      text: detail.contextSlug,
      href:
        base && detail.topic === "exhibition"
          ? `${base}/exhibitions/${encodeURIComponent(detail.contextSlug)}`
          : null,
    });
  }
  return links;
}
