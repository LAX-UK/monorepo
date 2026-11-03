import { timerText } from "@/components/lot-timer/format";
import type { LotPageView } from "@/lib/lot-page/build-lot-page-view";
import { splitStateText } from "@/lib/lot-page/split-state-text";
import {
  type LotLifecycleKind,
  type LotPosition,
  type LotStatusTone,
  lotLifecycleCopy,
  timeLeftView,
} from "@auction/domain";

/** How the line under the figure reads: the clock tightens from calm to soon to final. */
export type PhoneBarTone = "calm" | "soon" | "final";

/**
 * The line under the figure, in the two widths the bar may have: `words` when there is room and
 * `compact` (a clock such as "42:09", or a date) when there is not, so it never wraps.
 */
export type PhoneBarLine = {
  words: string;
  compact: string;
  tone: PhoneBarTone;
  clock: boolean;
};

export type PhoneBarSummary = {
  /** "Current bid" or "Starting bid" from the domain, or where the viewer stands on the lot. */
  label: string;
  /** The label's tone: calm for the price, warm or green when it says where the viewer stands. */
  labelTone: LotStatusTone;
  /** The figure as the page prints it. */
  amount: string | null;
  line: PhoneBarLine | null;
};

type LineBuilder = (view: LotPageView, nowMs: number) => PhoneBarLine | null;

function plain(text: string, clock = false): PhoneBarLine {
  return { words: text, compact: text, tone: "calm", clock };
}

function dated(prefix: string, date: string): PhoneBarLine {
  return plain(`${prefix} ${date}`, true);
}

const closing: LineBuilder = (view, nowMs) => {
  if (view.msLeft === null) return null;
  const timer = timerText(view.msLeft, nowMs);
  if (timer.date) return dated("Closes", timer.date);
  const { tone } = timeLeftView(view.msLeft, { extended: view.lifecycle === "extended" });
  return {
    words: `${timer.words} left`,
    compact: `${timer.compact} left`,
    tone,
    clock: true,
  };
};

const opening: LineBuilder = (view, nowMs) => {
  if (view.msLeft === null) return null;
  const timer = timerText(view.msLeft, nowMs);
  if (timer.date) return dated("Opens", timer.date);
  return {
    words: `Opens in ${timer.words}`,
    compact: `Opens in ${timer.compact}`,
    tone: "calm",
    clock: true,
  };
};

/** One row per lifecycle, so a new lifecycle is a new row rather than another branch. */
const LINE_BY_LIFECYCLE: Readonly<Partial<Record<LotLifecycleKind, LineBuilder>>> = {
  scheduled: opening,
  live: closing,
  extended: closing,
  liveSaleroom: () => plain("In the room"),
  saleroomPaused: () => plain("Sale paused"),
};

/** Where the viewer stands, in the words that replace the price label while it matters. */
const STANDING: Readonly<Partial<Record<LotPosition, { label: string; tone: LotStatusTone }>>> = {
  leading: { label: "You're leading", tone: "success" },
  outbid: { label: "Outbid", tone: "warning" },
  maximum_set: { label: "Maximum set", tone: "success" },
  won: { label: "You won", tone: "success" },
};

/** The winner's bar says when to pay, from the same line the price block shows. */
function payLine(view: LotPageView): PhoneBarLine | null {
  const text = view.price.stateLine?.text;
  if (!text) return null;
  const { title, detail } = splitStateText(text);
  return plain(detail ?? title);
}

/** Whether the lot has a phone bar: its lifecycle shows one, or the viewer won and has yet to pay. */
export function lotShowsPhoneBar(view: LotPageView): boolean {
  return lotLifecycleCopy(view.lifecycle).phoneBar || view.action === "pay";
}

/**
 * What the sticky phone bar says: the label and figure from the lot's price block, and one line
 * about time. `null` when the lot has no bar (ended, not sold, withdrawn).
 */
export function buildPhoneBarSummary(
  view: LotPageView,
  nowMs: number,
  position: LotPosition = "none",
): PhoneBarSummary | null {
  if (!lotShowsPhoneBar(view)) return null;
  const line =
    view.action === "pay"
      ? payLine(view)
      : (LINE_BY_LIFECYCLE[view.lifecycle]?.(view, nowMs) ?? null);
  // Paying means the viewer won, whatever else is known of their position.
  const standing = STANDING[view.action === "pay" ? "won" : position];
  return {
    label: standing?.label ?? view.price.label,
    labelTone: standing?.tone ?? "neutral",
    amount: view.price.amountText,
    line,
  };
}
