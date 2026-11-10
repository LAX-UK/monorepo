import {
  type LotLifecycleKind,
  TIME_LEFT_DATE_BEYOND_MS,
  type TimeLeftTone,
  countdownDisplay,
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

/** The moment a time row is about, for the visitor's own time under the official one. */
export type LotRowMoment = {
  /** The instant, as an ISO string. */
  iso: string;
  /** The zone the sale quotes its times in. */
  zone: string;
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
  /** Present when a bidder acts on the row's time, so it carries the visitor's time too. */
  moment?: LotRowMoment;
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
  /** The zone of the lot's sale, which every time on the row is quoted in. */
  timeZone: string;
};

type TimeRowBuilder = (ctx: TimeRowContext) => LotInfoRow | null;

/**
 * What the lot page's countdown rule prints for `msLeft`: the words the server draws are the
 * same ones the countdown leaf prints on its first tick, so nothing changes under the reader.
 */
function lotFace(
  msLeft: number,
  extended: boolean,
): { label: string; text: string; tone: TimeLeftTone } {
  const d = countdownDisplay("lot", msLeft, { extended });
  if (d.kind === "counting") return { label: d.label, text: d.text, tone: d.tone };
  return { label: "Time left", text: "", tone: "calm" };
}

/** The moment a bidder acts on, so the row can add the visitor's own time under it. */
function momentOf(iso: string | null, zone: string): { moment: LotRowMoment } | undefined {
  return iso ? { moment: { iso, zone } } : undefined;
}

function momentMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** "A late bid added 30 seconds · closes 18:42 GMT", or just the close when there is no figure. */
function extendedSub(ctx: TimeRowContext): string | null {
  const { endsAt, extendedByMs, now, timeZone: zone } = ctx;
  if (!endsAt) return null;
  const closes = formatLotMoment(endsAt, now, zone);
  if (extendedByMs && extendedByMs > 0) {
    const seconds = Math.round(extendedByMs / 1000);
    return `A late bid added ${seconds} second${seconds === 1 ? "" : "s"} · closes ${formatLotClock(endsAt, zone)}`;
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
      value: formatLotDay(ctx.endsAt, ctx.now, ctx.timeZone),
      sub: formatLotClock(ctx.endsAt, ctx.timeZone),
    },
    sub: extended
      ? extendedSub(ctx)
      : `Closes ${formatLotMoment(ctx.endsAt, ctx.now, ctx.timeZone)}`,
    extensions: ctx.extensions,
  };
}

const closingRow: TimeRowBuilder = (ctx) => {
  const { msLeft, endsAt, now, timeZone: zone } = ctx;
  if (msLeft === null) return null;
  const countdown = closingCountdown(ctx, false);
  // Beyond a week the day is the answer, not a count of days and hours.
  if (msLeft > TIME_LEFT_DATE_BEYOND_MS && endsAt) {
    return {
      label: "Closes",
      value: formatLotDay(endsAt, now, zone),
      sub: formatLotClock(endsAt, zone),
      tone: "calm",
      clock: true,
      ...(countdown ? { countdown } : {}),
      ...momentOf(endsAt, zone),
    };
  }
  const face = lotFace(msLeft, false);
  return {
    label: face.label,
    value: face.text,
    sub: endsAt ? `Closes ${formatLotMoment(endsAt, now, zone)}` : null,
    tone: face.tone,
    clock: true,
    ...(countdown ? { countdown } : {}),
    ...momentOf(endsAt, zone),
  };
};

const extendedRow: TimeRowBuilder = (ctx) => {
  const { msLeft } = ctx;
  if (msLeft === null) return null;
  const face = lotFace(msLeft, true);
  const countdown = closingCountdown(ctx, true);
  return {
    label: face.label,
    value: face.text,
    sub: extendedSub(ctx),
    tone: face.tone,
    clock: true,
    ...(countdown ? { countdown } : {}),
    ...momentOf(ctx.endsAt, ctx.timeZone),
  };
};

/** Zero reached and the server has not said how the lot ended. */
const closingNowRow: TimeRowBuilder = (ctx) => {
  // It keeps the countdown, aimed at the close that has passed: the same component carries the
  // row through Closing… and back to Extended if a late bid lands, so it can mark that bid.
  const countdown = closingCountdown(ctx, false);
  return {
    label: "Time left",
    value: "Closing…",
    sub: "The result follows in a moment",
    tone: "final",
    clock: true,
    ...(countdown ? { countdown } : {}),
  };
};

const opensRow: TimeRowBuilder = (ctx) => {
  const { msLeft, startsAt, now, timeZone: zone } = ctx;
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
            value: formatLotDay(startsAt, now, zone),
            sub: formatLotClock(startsAt, zone),
          },
          sub: formatLotMoment(startsAt, now, zone),
          extensions: 0,
        };
  if (msLeft > TIME_LEFT_DATE_BEYOND_MS) {
    return {
      label: "Opens",
      value: formatLotDay(startsAt, now, zone),
      sub: formatLotClock(startsAt, zone),
      tone: "calm",
      clock: true,
      ...(countdown ? { countdown } : {}),
      ...momentOf(startsAt, zone),
    };
  }
  return {
    label: msLeft > 0 ? "Opens in" : "Opens",
    value: msLeft > 0 ? lotFace(msLeft, false).text : "Opening…",
    sub: formatLotMoment(startsAt, now, zone),
    tone: "calm",
    clock: true,
    ...(countdown ? { countdown } : {}),
    ...momentOf(startsAt, zone),
  };
};

const roomRow: TimeRowBuilder = () => ({
  label: "Closing",
  value: "In the room",
  sub: "The auctioneer closes the lot",
  tone: "calm",
  clock: false,
});

const endedRow: TimeRowBuilder = ({ endsAt, now, timeZone: zone }) => {
  if (!endsAt) return null;
  return {
    label: "Ended",
    value: formatLotDay(endsAt, now, zone),
    sub: formatLotClock(endsAt, zone),
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
