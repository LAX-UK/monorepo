import "server-only";

import { getDeskDay, getDeskList } from "@/lib/data/http/admin-collection-desk.reader";
import {
  getCollectionSettings,
  getCollectionVenues,
} from "@/lib/data/http/admin-collections.reader";
import type {
  DeskDayView,
  DeskListView,
  StaffCollectionSettings,
  StaffCollectionVenue,
} from "@auction/types";
import { type CollectionTab, DESK_TABS, parseCollectionTab } from "./collections.vm";

/** What the desk tabs show: the day, or a list of visits, and how many missed visits wait. */
export type DeskModel = {
  /** The London day being looked at. */
  date: string;
  day: DeskDayView | null;
  list: DeskListView | null;
  /** Visits marked not collected that nobody has followed up; for the tab's count. */
  missedCount: number | null;
  /** The sentence to show when the desk could not load. */
  error: string | null;
};

export type CollectionsPageModel = {
  tab: CollectionTab;
  venues: StaffCollectionVenue[];
  settings: StaffCollectionSettings | null;
  desk: DeskModel | null;
  /** The sentence to show when the page could not load; null when it did. */
  loadError: string | null;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function loadDesk(tab: CollectionTab, venueId: string, date: string): Promise<DeskModel> {
  try {
    if (tab === "day") {
      const day = await getDeskDay(venueId, date);
      return { date, day, list: null, missedCount: day.notCollected, error: null };
    }
    const list = await getDeskList(venueId, tab === "upcoming" ? "upcoming" : "not_collected");
    const missedCount =
      tab === "not_collected"
        ? list.items.length
        : (await getDeskList(venueId, "not_collected")).items.length;
    return { date, day: null, list, missedCount, error: null };
  } catch {
    return {
      date,
      day: null,
      list: null,
      missedCount: null,
      error: "We couldn't load the visits. Try again in a moment.",
    };
  }
}

/**
 * The places, and the one being looked at (`?venue=`, else the first) with its settings, and for
 * the desk tabs the day or list of visits (`?date=` is a London day, else today).
 */
export async function loadCollectionsPage(
  search: Record<string, string | string[] | undefined>,
  today: string,
): Promise<CollectionsPageModel> {
  const tab = parseCollectionTab(search.tab);
  const asked = first(search.date);
  const date = asked && DAY.test(asked) ? asked : today;
  try {
    const venues = await getCollectionVenues();
    const wanted = first(search.venue);
    const venue = venues.find((v) => v.venueId === wanted) ?? venues[0];
    const settings = venue ? await getCollectionSettings(venue.venueId) : null;
    const desk =
      venue && settings && DESK_TABS.includes(tab)
        ? await loadDesk(tab, venue.venueId, date)
        : null;
    return { tab, venues, settings, desk, loadError: null };
  } catch {
    return {
      tab,
      venues: [],
      settings: null,
      desk: null,
      loadError: "We couldn't load the collection settings. Try again in a moment.",
    };
  }
}
