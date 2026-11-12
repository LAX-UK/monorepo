import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";

export type DealArtworkSearchInput = {
  /** Typed text, matched against the title, the artist and the stock code. Empty matches every original. */
  text: string;
  /**
   * What the enquiry describes. Originals that match it come first. Only read when it names an
   * artist or a title.
   */
  suggest?: { artist: string | null; title: string | null } | undefined;
  limit: number;
};

/** The register's originals, found for staff choosing a deal's artwork. Prints are never returned. */
export interface IDealArtworkSearchReader {
  searchOriginals(input: DealArtworkSearchInput): Promise<ArtworkRegisterEntry[]>;
}

/** The sale and lot that hold an artwork's place in LAX Bid. */
export type OpenLotPlace = {
  registerId: string;
  lotId: string;
  lotNumber: number | null;
  saleTitle: string | null;
  /** A draft lot is not live yet; a scheduled or active lot holds the place in a sale. */
  status: "draft" | "scheduled" | "active";
};

export interface IOpenLotPlaceReader {
  /** The lot holding each artwork's place in LAX Bid, if any. Artworks with none are left out. */
  listOpenLotPlaces(registerIds: readonly string[]): Promise<OpenLotPlace[]>;
}
