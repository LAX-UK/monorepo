import { type LotLifecycleKind, formatTimeLeft, timeLeftView } from "@auction/domain";
import { formatLotClock, formatLotDay, formatLotMoment } from "./lot-page-dates";

/** How a fact row reads: the clock tightens from calm to soon to final; an ended lot is quiet. */
export type LotInfoTone = "calm" | "soon" | "final" | "ended";

/** One label and value in the price block's fact grid. */
export type LotInfoRow = {
  label: string;
  value: string;
  sub: string | null;
  tone: LotInfoTone;
  /** The row is a clock, so it carries the clock icon. */
  clock: boolean;
};

export type TimeRowContext = {
  /** Until the lot opens (upcoming) or closes (timed); `null` when no clock applies. */
  msLeft: number | null;
  startsAt: string | null;
  endsAt: string | null;
  now: Date;
};

type TimeRowBuilder = (ctx: TimeRowContext) => LotInfoRow | null;

const closingRow: TimeRowBuilder = ({ msLeft, endsAt, now }) => {
  if (msLeft === null) return null;
  const view = timeLeftView(msLeft);
  return {
    label: view.label,
    value: view.text,
    sub: endsAt ? `Closes ${formatLotMoment(endsAt, now)}` : null,
    tone: view.tone,
    clock: true,
  };
};

const extendedRow: TimeRowBuilder = ({ msLeft, endsAt, now }) => {
  if (msLeft === null) return null;
  const view = timeLeftView(msLeft, { extended: true });
  return {
    label: view.label,
    value: view.text,
    sub: endsAt ? `Closes ${formatLotMoment(endsAt, now)}` : null,
    tone: view.tone,
    clock: true,
  };
};

const opensRow: TimeRowBuilder = ({ msLeft, startsAt, now }) => {
  if (msLeft === null || !startsAt) return null;
  return {
    label: msLeft > 0 ? "Opens in" : "Opens",
    value: msLeft > 0 ? formatTimeLeft(msLeft) : "Now",
    sub: formatLotMoment(startsAt, now),
    tone: "calm",
    clock: true,
  };
};

const roomRow: TimeRowBuilder = () => ({
  label: "Closing",
  value: "In the room",
  sub: "The auctioneer closes the lot",
  tone: "calm",
  clock: false,
});

const endedRow: TimeRowBuilder = ({ endsAt, now }) => {
  if (!endsAt) return null;
  return {
    label: "Ended",
    value: formatLotDay(endsAt, now),
    sub: formatLotClock(endsAt),
    tone: "ended",
    clock: false,
  };
};

const noRow: TimeRowBuilder = () => null;

/** One row per lifecycle: what its time line says, or nothing when there is no time to show. */
export const TIME_ROW_BUILDERS: Readonly<Record<LotLifecycleKind, TimeRowBuilder>> = {
  preLaunch: noRow,
  scheduled: opensRow,
  live: closingRow,
  extended: extendedRow,
  liveSaleroom: roomRow,
  saleroomPaused: noRow,
  endedSold: endedRow,
  endedNoSale: endedRow,
  cancelled: noRow,
  withdrawn: noRow,
};
