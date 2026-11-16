import { type StorageCalendar, type StorageTerms, createCollectionCalendar } from "@auction/domain";
import type { WaitingLotStorage } from "@auction/persistence/lib";
import type { StoredLot } from "../interfaces/collect-by.reader.js";

/** A place open every day, so a collect-by day never moves unless a test says so. */
export const OPEN_EVERY_DAY: StorageCalendar = createCollectionCalendar({
  hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    opensLocal: "10:00",
    closesLocal: "18:00",
  })),
  exceptions: [],
  rules: { closeOnSaleDays: false },
});

/** The approved defaults: 14 calendar days free, then £3 a day, or £6 for a large work. */
export const DEFAULT_TERMS: StorageTerms = {
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
  effectiveFrom: "2026-01-01",
};

/**
 * What prices a stored lot: by default a lot won before its place had terms (30 calendar days
 * free, nothing charged), at a place open every day that raises storage invoices.
 */
export function lotStorage(
  over: Partial<Omit<WaitingLotStorage, "pricing">> & {
    pricing?: Partial<WaitingLotStorage["pricing"]>;
  } = {},
): WaitingLotStorage {
  const { pricing, ...rest } = over;
  return {
    chargingOn: true,
    quote: null,
    calendar: OPEN_EVERY_DAY,
    ...rest,
    pricing: { terms: null, large: false, extensionDays: 0, waived: false, ...pricing },
  };
}

const PLACE = { name: "London Art Exchange", address: "156 New Cavendish Street, London W1W 6YW" };

/** A lot cleared on Mon 9 Nov 2026, waiting at the place. */
export const storedLot = (over: Partial<StoredLot> = {}): StoredLot => ({
  lotId: "l-1",
  legalEntityId: "e-1",
  venueId: "v-1",
  winnerId: "u-agent",
  title: "Lowland Storm",
  lotNumber: 12,
  clearedAt: new Date("2026-11-09T10:00:00Z"),
  place: PLACE,
  storage: lotStorage(),
  ...over,
});
