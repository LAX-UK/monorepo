import { lotPath } from "@auction/types";

export type ListingLinkOrigins = {
  /** lax.art, for a published listing. */
  artPublicUrl: string;
  /** LAX Admin, for a draft listing and for the register record. */
  laxAdminUrl: string;
  /** LAX Bid, for a public lot and for its admin page. */
  bidPublicUrl: string;
};

function base(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** Where each place is seen: a public page when buyers can see it, a staff page when not. */
export class ListingLinks {
  private readonly art: string;
  private readonly admin: string;
  private readonly bid: string;

  constructor(origins: ListingLinkOrigins) {
    this.art = base(origins.artPublicUrl);
    this.admin = base(origins.laxAdminUrl);
    this.bid = base(origins.bidPublicUrl);
  }

  registerRecord(registerId: string): string {
    return `${this.admin}/from-zoho/${encodeURIComponent(registerId)}`;
  }

  laxArtPublic(slug: string): string {
    return `${this.art}/artworks/${encodeURIComponent(slug)}`;
  }

  laxArtStaff(artworkId: string): string {
    return `${this.admin}/artworks/${encodeURIComponent(artworkId)}`;
  }

  bidLotPublic(lot: { id: string; title: string }): string {
    return `${this.bid}${lotPath(lot)}`;
  }

  bidLotStaff(lotId: string): string {
    return `${this.bid}/admin/lots/${encodeURIComponent(lotId)}`;
  }
}
