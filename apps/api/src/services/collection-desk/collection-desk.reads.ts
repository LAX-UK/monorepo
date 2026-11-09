import {
  collectionBlockMessage,
  collectionEligibility,
  collectionSlots,
  createCollectionCalendar,
  isDateKey,
  londonDateKey,
} from "@auction/domain";
import type { DeskClientLot, DeskDayView, DeskGroupView, DeskListView } from "@auction/types";
import { err, ok } from "neverthrow";
import { type CollectionDeskResult, deskError } from "./collection-desk.errors.js";
import { DAY_MS, type DeskSupport, TAKES_A_PLACE } from "./collection-desk.shared.js";

/** What the desk shows: a day of visits, the upcoming and missed lists, a client's lots. */
export class CollectionDeskReads {
  constructor(private readonly support: DeskSupport) {}

  private get deps() {
    return this.support.deps;
  }

  async day(venueId: string, date: string): Promise<CollectionDeskResult<DeskDayView>> {
    if (!isDateKey(date)) return err(deskError("invalid_date"));
    const settings = await this.deps.places.find(venueId);
    if (!settings) return err(deskError("place_not_set_up"));
    const now = this.deps.now();
    const facts = await this.support.placeFacts(venueId, date);
    const calendar = createCollectionCalendar({
      hours: facts.hours,
      exceptions: facts.exceptions,
      rules: facts.settings,
    });
    const plan = calendar.plan(date);

    // The times the day offers, whatever the notice: staff see the day as it is, not as a buyer does.
    const offered = collectionSlots({
      hours: facts.hours,
      exceptions: facts.exceptions,
      rules: { ...facts.settings, windowDays: 1 },
      now: new Date(`${date}T12:00:00.000Z`),
    })[0];
    const bookings = (
      await this.deps.bookings.listInRange(venueId, {
        from: new Date(new Date(`${date}T12:00:00.000Z`).getTime() - DAY_MS),
        to: new Date(new Date(`${date}T12:00:00.000Z`).getTime() + DAY_MS),
      })
    ).filter((booking) => londonDateKey(booking.slotStart) === date);

    const views = await this.support.views(bookings, facts.settings, facts, now);
    const capacity = facts.settings.placesPerSlot;
    const starts = new Map<number, { start: Date; end: Date }>();
    for (const slot of offered?.slots ?? []) starts.set(slot.start.getTime(), slot);
    for (const booking of bookings)
      starts.set(booking.slotStart.getTime(), { start: booking.slotStart, end: booking.slotEnd });
    const groups: DeskGroupView[] = [...starts.values()]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((slot) => {
        const inSlot = views.filter(
          (view) => new Date(view.start).getTime() === slot.start.getTime(),
        );
        return {
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          taken: inSlot.filter((view) => TAKES_A_PLACE.includes(view.status)).length,
          capacity,
          bookings: inSlot,
        };
      });
    // A time still on offer: it has a place left and has not started.
    const openTimes = groups.filter(
      (group) => group.taken < group.capacity && new Date(group.start).getTime() > now.getTime(),
    ).length;
    return ok({
      venueId,
      date,
      state: plan.kind === "closed" ? (plan.reason === "sale_day" ? "sale_day" : "closed") : "open",
      canOpenAnyway: plan.kind === "closed" && plan.reason === "sale_day",
      capacity,
      visitMinutes: facts.settings.visitMinutes,
      openTimes,
      groups,
      toHandOver: views.filter((view) => view.status === "booked").length,
      notCollected: await this.deps.bookings.countOpenNotCollected(venueId),
    });
  }

  async list(
    venueId: string,
    status: "upcoming" | "not_collected",
  ): Promise<CollectionDeskResult<DeskListView>> {
    const settings = await this.deps.places.find(venueId);
    if (!settings) return err(deskError("place_not_set_up"));
    const now = this.deps.now();
    const facts = await this.support.placeFacts(venueId, londonDateKey(now));
    const notCollected = await this.deps.bookings.countOpenNotCollected(venueId);
    if (status === "not_collected") {
      const missed = await this.support.missed(venueId, facts.settings, facts, now);
      return ok({ venueId, status, items: missed.items, more: missed.more, notCollected });
    }
    const upcoming = (
      await this.deps.bookings.listInRange(venueId, {
        from: now,
        to: new Date(now.getTime() + (facts.settings.windowDays + 2) * DAY_MS),
      })
    ).filter((booking) => booking.status === "booked");
    return ok({
      venueId,
      status,
      items: await this.support.views(upcoming, facts.settings, facts, now),
      more: false,
      notCollected,
    });
  }

  async clientLots(
    venueId: string,
    legalEntityId: string,
  ): Promise<CollectionDeskResult<DeskClientLot[]>> {
    if (!(await this.deps.places.find(venueId))) return err(deskError("place_not_set_up"));
    const ids = await this.deps.facts.lotIdsForBuyer(legalEntityId, venueId, 100);
    const found = await this.deps.facts.read(ids);
    const lines: DeskClientLot[] = [];
    for (const lotId of ids) {
      const record = found.get(lotId);
      if (!record) continue;
      const decision = collectionEligibility(record.facts);
      lines.push({
        lotId,
        title: record.title,
        lotNumber: record.lotNumber,
        collectable: decision.eligible,
        blockedMessage: decision.eligible ? null : collectionBlockMessage(decision.reason),
      });
    }
    return ok(lines);
  }
}
