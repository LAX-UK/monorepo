import "server-only";

import {
  getCollectionSettings,
  getCollectionVenues,
} from "@/lib/data/http/admin-collections.reader";
import type { StaffCollectionSettings, StaffCollectionVenue } from "@auction/types";
import { type CollectionTab, parseCollectionTab } from "./collections.vm";

export type CollectionsPageModel = {
  tab: CollectionTab;
  venues: StaffCollectionVenue[];
  settings: StaffCollectionSettings | null;
  /** The sentence to show when the page could not load; null when it did. */
  loadError: string | null;
};

/** The places, and the one being looked at (the one in the address, else the first) with its settings. */
export async function loadCollectionsPage(
  venueId: string | undefined,
  search: Record<string, string | string[] | undefined>,
): Promise<CollectionsPageModel> {
  const tab = parseCollectionTab(search.tab);
  try {
    const venues = await getCollectionVenues();
    const venue = venues.find((v) => v.venueId === venueId) ?? venues[0];
    const settings = venue ? await getCollectionSettings(venue.venueId) : null;
    return { tab, venues, settings, loadError: null };
  } catch {
    return {
      tab,
      venues: [],
      settings: null,
      loadError: "We couldn't load the collection settings. Try again in a moment.",
    };
  }
}
