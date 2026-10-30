import type { ActivityQuery } from "@/lib/data/http/organisation-team.types";
import { activityQueryString } from "@/lib/data/http/organisation-team.types";
import { teamHref } from "@/lib/navigation/client-routes";
import { ACTIVITY_GROUPS, type ActivityGroup } from "@auction/domain";

/**
 * The Activity tab's filters, kept in the address so a filtered view can be shared or reloaded:
 * `person` (a member's user id), `group` (one kind of change) and `period` (how far back).
 */

export const ACTIVITY_PERIODS = ["30d", "90d", "12m"] as const;
export type ActivityPeriod = (typeof ACTIVITY_PERIODS)[number];

export const ACTIVITY_PERIOD_LABEL: Record<ActivityPeriod, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
};

export const ACTIVITY_GROUP_LABEL: Record<ActivityGroup, string> = {
  members: "Members",
  bidding: "Bidding",
  selling: "Selling",
  money: "Money",
  security: "Security",
};

export type ActivityFilters = {
  person: string | null;
  group: ActivityGroup | null;
  period: ActivityPeriod;
};

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  person: null,
  group: null,
  period: "12m",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The filters in an address; anything unknown falls back to the whole 12 months. */
export function parseActivityFilters(params: SearchParams): ActivityFilters {
  const person = first(params.person)?.trim() || null;
  const group = first(params.group);
  const period = first(params.period);
  return {
    person: person && person.length <= 200 ? person : null,
    group: ACTIVITY_GROUPS.includes(group as ActivityGroup) ? (group as ActivityGroup) : null,
    period: ACTIVITY_PERIODS.includes(period as ActivityPeriod)
      ? (period as ActivityPeriod)
      : DEFAULT_ACTIVITY_FILTERS.period,
  };
}

/** The address's search part for these filters, without defaults ("" for none). */
export function activityFiltersSearch(filters: ActivityFilters): string {
  const params = new URLSearchParams();
  if (filters.person) params.set("person", filters.person);
  if (filters.group) params.set("group", filters.group);
  if (filters.period !== DEFAULT_ACTIVITY_FILTERS.period) params.set("period", filters.period);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** One person's Activity: the "View activity" link on a member's row. */
export function activityHrefForPerson(userId: string): string {
  return `${teamHref("activity")}${activityFiltersSearch({ ...DEFAULT_ACTIVITY_FILTERS, person: userId })}`;
}

/** When a period starts, counted back from `now`. */
function periodStart(period: ActivityPeriod, now: Date): Date {
  const start = new Date(now);
  if (period === "12m") start.setUTCMonth(start.getUTCMonth() - 12);
  else start.setUTCDate(start.getUTCDate() - (period === "30d" ? 30 : 90));
  return start;
}

/** The API query for these filters; the 12-month view leaves the start to the API's own limit. */
export function activityQueryFor(filters: ActivityFilters, now: Date): ActivityQuery {
  return {
    ...(filters.person ? { person: filters.person } : {}),
    ...(filters.group ? { group: [filters.group] } : {}),
    ...(filters.period === "12m" ? {} : { from: periodStart(filters.period, now).toISOString() }),
  };
}

/** The CSV of exactly what the filters show. */
export function activityExportHref(filters: ActivityFilters, now: Date): string {
  const qs = activityQueryString(activityQueryFor(filters, now));
  return `${teamHref("activity")}/export${qs ? `?${qs}` : ""}`;
}

/** Whether any filter narrows the list (for "No results" rather than "Nothing yet"). */
export function activityFiltered(filters: ActivityFilters): boolean {
  return Boolean(filters.person || filters.group) || filters.period !== "12m";
}
