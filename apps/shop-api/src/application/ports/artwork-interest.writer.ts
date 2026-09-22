export type ArtworkInterestContext = {
  artworkId: string;
  artworkSlug: string;
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
    identitySubjectId: string;
    intent: ArtworkInterestIntent;
  }): Promise<RegisterArtworkInterestResult>;
  getInterestStatus(input: {
    artworkId: string;
    identitySubjectId: string;
    intent: ArtworkInterestIntent;
  }): Promise<{ subscribed: boolean }>;
}
