import {
  type LotLifecycleKind,
  TIME_LEFT_DATE_BEYOND_MS,
  formatTimeLeft,
  timeLeftShowsSeconds,
  timeLeftView,
} from "@auction/domain";
import { formatLotClock, formatLotDay, formatLotMoment } from "./lot-page-dates";

/** How a fact row reads: the clock tightens from calm to soon to final; an ended lot is quiet. */
export type LotInfoTone = "calm" | "soon" | "final" | "ended";

/**
 * A time row that counts. The row's own text is only what the server draws and what shows before
 * the clock is running; once it runs, the countdown leaf reads the shared clock and prints the
 * rest, so the page itself never re-renders to tick.
 */
export type LotRowCountdown = {
  /** The moment counted to, in epoch milliseconds. */
  targetMs: number;
  kind: "closes" | "opens";
  /** The lot is in a soft-close extension. */
  extended: boolean;
  /** Beyond a week the row tells a day instead of counting: its label, value and second line. */
  date: { label: string; value: string; sub: string | null };
  /** The second line while counting. */
  sub: string | null;
  /** How many extensions the lot has had, so a new one can be marked once. */
  extensions: number;
};

/** One label and value in the price block's fact grid. */
export type LotInfoRow = {
  label: string;
  value: string;
  sub: string | null;
  tone: LotInfoTone;
  /** The row is a clock, so it carries the clock icon. */
  clock: boolean;
  /** Present when the row counts. */
  countdown?: LotRowCountdown;
};

export type TimeRowContext = {
  /** Until the lot opens (upcoming) or closes (timed); `null` when no clock applies. */
  msLeft: number | null;
  startsAt: string | null;
  endsAt: string | null;
  now: Date;
  /** How long the last late bid added, when the lot has been extended. */
  extendedByMs: number | null;
  /** How many late bids have extended the lot. */
  extensions: number;
};

type TimeRowBuilder = (ctx: TimeRowContext) => LotInfoRow | null;

function momentMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** "A late bid added 30 seconds · closes 18:42 GMT", or just the close when there is no figure. */
function extendedSub(ctx: TimeRowContext): string | null {
  const { endsAt, extendedByMs, now } = ctx;
  if (!endsAt) return null;
  const closes = formatLotMoment(endsAt, now);
  if (extendedByMs && extendedByMs > 0) {
    const seconds = Math.round(extendedByMs / 1000);
    return `A late bid added ${seconds} second${seconds === 1 ? "" : "s"} · closes ${formatLotClock(endsAt)}`;
  }
  return `Closes ${closes}`;
}

function closingCountdown(ctx: TimeRowContext, extended: boolean): LotRowCountdown | undefined {
  const targetMs = momentMs(ctx.endsAt);
  if (targetMs === null || !ctx.endsAt) return undefined;
  return {
    targetMs,
    kind: "closes",
    extended,
    date: {
      label: "Closes",
      value: formatLotDay(ctx.endsAt, ctx.now),
      sub: formatLotClock(ctx.endsAt),
    },
    sub: extended ? extendedSub(ctx) : `Closes ${formatLotMoment(ctx.endsAt, ctx.now)}`,
    extensions: ctx.extensions,
  };
}

const closingRow: TimeRowBuilder = (ctx) => {
  const { msLeft, endsAt, now } = ctx;
  if (msLeft === null) return null;
  const countdown = closingCountdown(ctx, false);
  // Beyond a week the day is the answer, not a count of days and hours.
  if (msLeft > TIME_LEFT_DATE_BEYOND_MS && endsAt) {
    return {
      label: "Closes",
      value: formatLotDay(endsAt, now),
      sub: formatLotClock(endsAt),
      tone: "calm",
      clock: true,
      ...(countdown ? { countdown } : {}),
    };
  }
  const view = timeLeftView(msLeft);
  return {
    label: view.label,
    value: view.text,
    sub: endsAt ? `Closes ${formatLotMoment(endsAt, now)}` : null,
    tone: view.tone,
    clock: true,
    ...(countdown ? { countdown } : {}),
  };
};

const extendedRow: TimeRowBuilder = (ctx) => {
  const { msLeft } = ctx;
  if (msLeft === null) return null;
  const view = timeLeftView(msLeft, { extended: true });
  const countdown = closingCountdown(ctx, true);
  return {
    label: view.label,
    value: view.text,
    sub: extendedSub(ctx),
    tone: view.tone,
    clock: true,
    ...(countdown ? { countdown } : {}),
  };
};

/** Zero reached and the server has not said how the lot ended. */
const closingNowRow: TimeRowBuilder = () => ({
  label: "Time left",
  value: "Closing…",
  sub: "The result follows in a moment",
  tone: "final",
  clock: true,
});

const opensRow: TimeRowBuilder = (ctx) => {
  const { msLeft, startsAt, now } = ctx;
  if (msLeft === null || !startsAt) return null;
  const targetMs = momentMs(startsAt);
  const countdown: LotRowCountdown | undefined =
    targetMs === null
      ? undefined
      : {
          targetMs,
          kind: "opens",
          extended: false,
          date: {
            label: "Opens",
            value: formatLotDay(startsAt, now),
            sub: formatLotClock(startsAt),
          },
          sub: formatLotMoment(startsAt, now),
          extensions: 0,
        };
  if (msLeft > TIME_LEFT_DATE_BEYOND_MS) {
    return {
      label: "Opens",
      value: formatLotDay(startsAt, now),
      sub: formatLotClock(startsAt),
      tone: "calm",
      clock: true,
      ...(countdown ? { countdown } : {}),
    };
  }
  return {
    label: msLeft > 0 ? "Opens in" : "Opens",
    value:
      msLeft > 0
        ? formatTimeLeft(msLeft, { showSeconds: timeLeftShowsSeconds(msLeft) })
        : "Opening…",
    sub: formatLotMoment(startsAt, now),
    tone: "calm",
    clock: true,
    ...(countdown ? { countdown } : {}),
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
  closing: closingNowRow,
  liveSaleroom: roomRow,
  saleroomPaused: noRow,
  endedSold: endedRow,
  endedNoSale: endedRow,
  cancelled: noRow,
  withdrawn: noRow,
};
