import "server-only";

import { getDeskDay, getDeskList } from "@/lib/data/http/admin-collection-desk.reader";
import { getOverdueLots } from "@/lib/data/http/admin-collection-overdue.reader";
import { getCollectionStorage } from "@/lib/data/http/admin-collection-storage.reader";
import {
  getCollectionSettings,
  getCollectionVenues,
} from "@/lib/data/http/admin-collections.reader";
import type {
  DeskDayView,
  DeskListView,
  StaffCollectionSettings,
  StaffCollectionVenue,
  StaffOverdueLots,
  StaffStorageSettings,
} from "@auction/types";
import {
  type CollectionTab,
  type CollectionsAccess,
  DESK_TABS,
  parseCollectionTab,
} from "./collections.vm";
import { NOT_COLLECTED_COPY } from "./not-collected-copy";
import { STORAGE_COPY } from "./storage-copy";

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

/** What the Storage tab shows: the place's terms, or the sentence to show when they did not load. */
export type StorageModel = {
  settings: StaffStorageSettings | null;
  error: string | null;
};

/** What the Not collected tab shows of the lots past their collect-by day, or why it didn't load. */
export type OverdueModel = {
  lots: StaffOverdueLots | null;
  error: string | null;
};

export type CollectionsPageModel = {
  tab: CollectionTab;
  venues: StaffCollectionVenue[];
  /** The place being looked at; null when there is none to collect from. */
  venueId: string | null;
  /** Its hours, rules and closures; null for someone who sees only Storage. */
  settings: StaffCollectionSettings | null;
  desk: DeskModel | null;
  storage: StorageModel | null;
  /** The lots past their collect-by day, on the Not collected tab. */
  overdue: OverdueModel | null;
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
    return { date, day: null, list, missedCount: list.notCollected, error: null };
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

async function loadOverdue(venueId: string): Promise<OverdueModel> {
  try {
    return { lots: await getOverdueLots(venueId), error: null };
  } catch {
    return { lots: null, error: NOT_COLLECTED_COPY.loadError.body };
  }
}

async function loadStorage(venueId: string): Promise<StorageModel> {
  try {
    return { settings: await getCollectionStorage(venueId), error: null };
  } catch {
    return { settings: null, error: STORAGE_COPY.loadError.body };
  }
}

/**
 * The places, and the one being looked at (`?venue=`, else the first) with its settings, and for
 * the desk tabs the day or list of visits (`?date=` is a London day, else today).
 */
export async function loadCollectionsPage(
  search: Record<string, string | string[] | undefined>,
  today: string,
  access: CollectionsAccess = { settings: true, storage: true },
): Promise<CollectionsPageModel> {
  const tab = parseCollectionTab(search.tab, access);
  const asked = first(search.date);
  const date = asked && DAY.test(asked) ? asked : today;
  try {
    const venues = await getCollectionVenues();
    const wanted = first(search.venue);
    const venue = venues.find((v) => v.venueId === wanted) ?? venues[0];
    const venueId = venue?.venueId ?? null;
    const settings = venueId && access.settings ? await getCollectionSettings(venueId) : null;
    const desk =
      venueId && settings && DESK_TABS.includes(tab) ? await loadDesk(tab, venueId, date) : null;
    const [storage, overdue] = await Promise.all([
      venueId && tab === "storage" ? loadStorage(venueId) : null,
      venueId && tab === "not_collected" ? loadOverdue(venueId) : null,
    ]);
    return { tab, venues, venueId, settings, desk, storage, overdue, loadError: null };
  } catch {
    return {
      tab,
      venues: [],
      venueId: null,
      settings: null,
      desk: null,
      storage: null,
      overdue: null,
      loadError: "We couldn't load the collection settings. Try again in a moment.",
    };
  }
}
