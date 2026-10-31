export type ArtworkInterestContext = {
  artworkId: string;
  artworkSlug: string;
  salesChannel: "shop" | "art";
  eligibleForEditionAllocation: boolean;
  printPricePence: number | null;
  editionsAvailable: number;
  saleState: "for_sale" | "price_on_application" | "sold";
};

import type { ArtworkInterestIntent } from "../artwork-interest-intent.js";
import type { EnquirySender } from "../enquiry-sender.js";

/** An enquiry carries its reference ("E-2041"); an edition alert has none. */
export type RegisterArtworkInterestResult =
  | { status: "registered" | "already_subscribed"; reference: string | null }
  | { status: "not_found" };

export interface ArtworkInterestWriter {
  loadInterestContext(artworkSlug: string): Promise<ArtworkInterestContext | null>;
  registerInterest(input: {
    artworkId: string;
    artworkSlug: string;
    salesChannel: "shop" | "art";
    /** Guests may only register `enquiry` interest. */
    sender: EnquirySender;
    intent: ArtworkInterestIntent;
    message?: string | undefined;
    contactPhone?: string | undefined;
  }): Promise<RegisterArtworkInterestResult>;
  getInterestStatus(input: {
    artworkId: string;
    identitySubjectId: string;
    intent: ArtworkInterestIntent;
  }): Promise<{ subscribed: boolean }>;
}
