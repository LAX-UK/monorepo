import {
  type LotLifecycleKind,
  TIME_LEFT_MARKS,
  formatCountdownSpoken,
  lotLifecycleCopy,
} from "@auction/domain";

/** A mark is said only if the clock crossed it this recently, so one passed while hidden is not replayed. */
const JUST_CROSSED_MS = 3_000;
/** Extensions are said at most this often, however fast the late bids come. */
const EXTENSION_MIN_GAP_MS = 15_000;

export type TimeAnnouncementState = {
  initialised: boolean;
  /** Marks already passed or said, by their millisecond value. */
  marks: Set<number>;
  extensions: number;
  lastExtensionAt: number;
  lifecycle: LotLifecycleKind | null;
};

export function newTimeAnnouncementState(): TimeAnnouncementState {
  return {
    initialised: false,
    marks: new Set(),
    extensions: 0,
    lastExtensionAt: Number.NEGATIVE_INFINITY,
    lifecycle: null,
  };
}

export type TimeAnnouncementInput = {
  nowMs: number;
  /** When the lot closes, or null when it has no clock. */
  endMs: number | null;
  lifecycle: LotLifecycleKind;
  extensions: number;
  /** Words are said only while the tab is on screen. */
  visible: boolean;
};

const COUNTING: ReadonlySet<LotLifecycleKind> = new Set(["live", "extended"]);

/**
 * What the page's live region should say now, and updates `state`. Pure apart from `state`: marks
 * at an hour, ten, five, two and one minute (each once, the tightest if several were crossed),
 * each extension (at most every 15 seconds), the close and the result. Nothing is said for what
 * was already true when the page opened, nor for a mark crossed while the tab was hidden.
 */
export function nextTimeAnnouncements(
  state: TimeAnnouncementState,
  input: TimeAnnouncementInput,
): string[] {
  const said: string[] = [];
  const remaining = input.endMs === null ? null : input.endMs - input.nowMs;
  const counting = COUNTING.has(input.lifecycle) && remaining !== null && remaining > 0;

  if (counting && remaining !== null) {
    const crossed = TIME_LEFT_MARKS.filter(
      (mark) => remaining <= mark.ms && !state.marks.has(mark.ms),
    );
    for (const mark of crossed) state.marks.add(mark.ms);
    const fresh = crossed.filter((mark) => remaining > mark.ms - JUST_CROSSED_MS);
    const tightest = fresh[fresh.length - 1];
    if (state.initialised && input.visible && tightest) said.push(tightest.announcement);
  }

  if (state.initialised && input.extensions > state.extensions) {
    if (input.visible && input.nowMs - state.lastExtensionAt >= EXTENSION_MIN_GAP_MS) {
      state.lastExtensionAt = input.nowMs;
      const left =
        remaining !== null && remaining > 0 ? ` ${formatCountdownSpoken(remaining)} left.` : "";
      said.push(`Extended.${left}`);
    }
  }
  state.extensions = Math.max(state.extensions, input.extensions);

  const before = state.lifecycle;
  if (state.initialised && before !== null && before !== input.lifecycle) {
    if (input.lifecycle === "closing" && COUNTING.has(before)) {
      said.push("Bidding has closed");
    } else if (input.lifecycle === "endedSold" || input.lifecycle === "endedNoSale") {
      const result = input.lifecycle === "endedSold" ? "This lot sold." : "This lot did not sell.";
      const closedAlready = before === "closing";
      if (COUNTING.has(before) || closedAlready) {
        said.push(closedAlready ? result : `Bidding has closed. ${result}`);
      }
    }
  }
  // A lot that is no longer biddable has nothing more to mark.
  if (!lotLifecycleCopy(input.lifecycle).biddingOpen && input.lifecycle !== "closing") {
    for (const mark of TIME_LEFT_MARKS) state.marks.add(mark.ms);
  }
  state.lifecycle = input.lifecycle;
  state.initialised = true;
  return said;
}

/** Milliseconds until the next moment this page may have something to say, or null. */
export function nextAnnouncementWake(
  state: TimeAnnouncementState,
  input: Pick<TimeAnnouncementInput, "nowMs" | "endMs" | "lifecycle">,
): number | null {
  if (!COUNTING.has(input.lifecycle) || input.endMs === null) return null;
  const remaining = input.endMs - input.nowMs;
  let wait = remaining > 0 ? remaining + 1 : null;
  for (const mark of TIME_LEFT_MARKS) {
    if (state.marks.has(mark.ms) || remaining <= mark.ms) continue;
    const toMark = remaining - mark.ms;
    if (wait === null || toMark < wait) wait = toMark;
  }
  return wait;
}
