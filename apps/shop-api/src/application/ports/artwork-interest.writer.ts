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

export type RegisterArtworkInterestResult = "registered" | "already_subscribed" | "not_found";

export interface ArtworkInterestWriter {
  loadInterestContext(artworkSlug: string): Promise<ArtworkInterestContext | null>;
  registerInterest(input: {
    artworkId: string;
    artworkSlug: string;
    salesChannel: "shop" | "art";
    identitySubjectId: string;
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
