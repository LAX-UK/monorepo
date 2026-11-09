import type { StaffCollectionSettings } from "@auction/types";

/** One place's saved collection settings, for tests. */
export const SETTINGS: StaffCollectionSettings = {
  venueId: "d0000000-0000-4000-8000-0000000000aa",
  version: "2026-11-01T09:00:00.000Z",
  onlineBookingEnabled: false,
  bookingEmail: null,
  visitMinutes: 30,
  placesPerSlot: 2,
  noticeCutoffLocal: "16:00",
  noticeWorkingDays: 1,
  windowDays: 28,
  closeOnSaleDays: true,
  undoHandOverMinutes: 15,
  maxActiveVisits: 5,
  freeStorageDays: null,
  hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opensLocal: "10:00", closesLocal: "19:00" })),
  exceptions: [],
  nextSaleDay: null,
};
