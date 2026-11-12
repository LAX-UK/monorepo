import { LONDON_TIME_ZONE, formatDayMonthOnly, formatWeekday } from "@auction/datetime";
import { formatCollectionDay, formatCollectionVisit, formatCollectionWhen } from "@auction/domain";
import type { CollectionVisitView } from "@auction/types";
import { COLLECT_COPY } from "./collect-copy";
import { changeCollectionHref, collectHref, collectionCalendarHref } from "./collect-links";

/** What a booked, past or closed visit shows, drawn the same on the purchase and in the list. */
export type VisitCardVm = {
  id: string;
  reference: string;
  /** Booked and still to come: the only state that can be changed. */
  live: boolean;
  status: CollectionVisitView["status"];
  /** The date tile: "Thu", "12", "Nov". */
  tile: { weekday: string; day: string; month: string };
  /** "Thu 12 Nov, 14:00–14:30 GMT". */
  when: string;
  where: string;
  lots: { lotId: string; title: string; lotNumber: number | null; note: string | null }[];
  /** Who collects, with the company when there is one. */
  collector: { name: string; detail: string | null; thirdParty: boolean };
  /** The photo ID rule, naming the person who will be asked for it. */
  idRule: string;
  /** "Change or cancel online until Wed 11 Nov, 16:00 GMT." while the person can. */
  deadline: string | null;
  /** The way to change it once the cut-off has passed. */
  afterCutoff: string | null;
  can: { change: boolean; cancel: boolean; calendar: boolean };
  changeHref: string;
  calendarHref: string;
  /** A missed, partly collected or collected visit says so plainly. */
  outcome: { tone: "info" | "warning" | "success"; title: string; body: string | null } | null;
  /** The way back to a new time after a missed visit. */
  rebook: { label: string; href: string } | null;
  /** Another member of the organisation made this booking; the name is never shown. */
  bookedByAnother: boolean;
  /** Why the date reads as it does for a cancelled visit. */
  cancelled: boolean;
};

function lotNote(lot: CollectionVisitView["lots"][number], status: CollectionVisitView["status"]) {
  if (!lot.active && status !== "cancelled") return "Not in this visit";
  if (lot.outcome === "left") return "Stayed with us";
  if (lot.outcome === "collected") return "Collected";
  return null;
}

function outcomeOf(visit: CollectionVisitView, now: Date, start: Date): VisitCardVm["outcome"] {
  const day = formatCollectionDay(start, now);
  const left = visit.lots.filter((lot) => lot.outcome === "left").map((lot) => lot.title);
  switch (visit.status) {
    case "not_collected":
      return { tone: "warning", title: COLLECT_COPY.missed.title(day), body: null };
    case "partly_collected":
      return {
        tone: "info",
        title: "Partly collected",
        body: COLLECT_COPY.partly(left.join(" and ") || "A lot", day),
      };
    case "collected": {
      const at = visit.handedOverAt ? new Date(visit.handedOverAt) : start;
      return {
        tone: "success",
        title: "Collected",
        body: COLLECT_COPY.done(visit.collector.name, formatCollectionWhen(at, now)),
      };
    }
    default:
      return null;
  }
}

/** A visit as the page draws it. `contact` is where to write once the cut-off has passed. */
export function visitCard(
  visit: CollectionVisitView,
  context: { now: Date; contactEmail: string },
): VisitCardVm {
  const start = new Date(visit.start);
  const end = new Date(visit.end);
  const upcoming = visit.status === "booked" && start.getTime() > context.now.getTime();
  const canChange = upcoming && visit.actions.includes("change");
  const canCancel = upcoming && visit.actions.includes("cancel");
  const deadline = visit.noticeDeadline ? new Date(visit.noticeDeadline) : null;
  const collector = visit.collector;
  const thirdParty = collector.kind === "third_party";
  const activeLots = visit.lots.filter((lot) => lot.active || visit.status !== "booked");
  const [day = "", month = ""] = formatDayMonthOnly(start, LONDON_TIME_ZONE).split(" ");
  return {
    id: visit.id,
    reference: visit.reference,
    live: upcoming,
    status: visit.status,
    tile: {
      weekday: formatWeekday(start, LONDON_TIME_ZONE),
      day,
      month,
    },
    when: formatCollectionVisit(start, end, context.now),
    where: COLLECT_COPY.where,
    lots: activeLots.map((lot) => ({
      lotId: lot.lotId,
      title: lot.title,
      lotNumber: lot.lotNumber,
      note: lotNote(lot, visit.status),
    })),
    collector: {
      name: collector.name,
      detail:
        [thirdParty ? "Third party" : null, collector.company].filter(Boolean).join(" · ") || null,
      thirdParty,
    },
    idRule: COLLECT_COPY.booked.idRule(collector.name),
    deadline:
      (canChange || canCancel) && deadline
        ? COLLECT_COPY.booked.deadline(formatCollectionWhen(deadline, context.now))
        : null,
    afterCutoff:
      upcoming &&
      !canChange &&
      !canCancel &&
      visit.actions.length === 0 &&
      visit.noticeDeadline === null
        ? COLLECT_COPY.booked.afterCutoff(context.contactEmail)
        : null,
    can: { change: canChange, cancel: canCancel, calendar: upcoming },
    changeHref: changeCollectionHref(visit.id),
    calendarHref: collectionCalendarHref(visit.id),
    outcome: outcomeOf(visit, context.now, start),
    rebook:
      visit.status === "not_collected" || visit.status === "partly_collected"
        ? {
            label: COLLECT_COPY.missed.again,
            href: collectHref(
              visit.lots.filter((lot) => lot.outcome !== "collected").map((lot) => lot.lotId),
            ),
          }
        : null,
    bookedByAnother: !visit.bookedByYou && visit.bookedVia === "client",
    cancelled: visit.status === "cancelled",
  };
}

/** Visits to come first, soonest at the top; the rest after, newest first. */
export function orderVisits(visits: readonly CollectionVisitView[], now: Date) {
  const upcoming = visits
    .filter((visit) => visit.status === "booked" && new Date(visit.start) > now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const earlier = visits
    .filter((visit) => !upcoming.includes(visit))
    .sort((a, b) => b.start.localeCompare(a.start));
  return { upcoming, earlier };
}
