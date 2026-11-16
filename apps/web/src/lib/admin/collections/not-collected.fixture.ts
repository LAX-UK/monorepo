import type { StaffOverdueLot, StaffOverdueLots } from "@auction/types";
import { STORAGE_TODAY, STORAGE_VENUE } from "./storage.fixture";

/** Lots past their collect-by day as the Not collected tab reads them, for tests and e2e screens. */
export const OVERDUE_LOT: StaffOverdueLot = {
  lotId: "d0000000-0000-4000-8000-0000000000d1",
  lotNumber: 12,
  title: "Lowland Storm",
  buyerName: "Northfield Collection Ltd",
  collectBy: "2026-11-01",
  daysOver: 14,
  band: "standard",
  amountPence: 4200,
  amountDetail: "£42.00 so far (14 days at £3 a day), plus VAT where it applies.",
  extensionDays: 0,
  extensionDaysLeft: 30,
  waived: false,
  followUp: false,
  legacyTerms: false,
};

export const OVERDUE_FOLLOW_UP: StaffOverdueLot = {
  ...OVERDUE_LOT,
  lotId: "d0000000-0000-4000-8000-0000000000d2",
  lotNumber: 31,
  title: "Harbour at Dusk",
  buyerName: "A private buyer",
  collectBy: "2026-09-10",
  daysOver: 66,
  band: "large",
  amountPence: 39_600,
  amountDetail: "£396.00 so far (66 days at £6 a day), plus VAT where it applies.",
  extensionDays: 30,
  extensionDaysLeft: 0,
  followUp: true,
};

export const OVERDUE: StaffOverdueLots = {
  venueId: STORAGE_VENUE,
  today: STORAGE_TODAY,
  chargingOn: false,
  more: false,
  total: 2,
  lots: [OVERDUE_FOLLOW_UP, OVERDUE_LOT],
};
