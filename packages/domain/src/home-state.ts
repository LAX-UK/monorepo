/**
 * Which state the public home page is in, derived only from the sales on offer.
 * Pure: the caller supplies `now`, the sales, any staff pins and the viewer.
 *
 * States are checked in priority order, so exactly one applies:
 * live, just ended, upcoming, recent results, between seasons.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The windows that decide the state. One table so operations can tune them. */
export const HOME_STATE_WINDOWS = {
  /** A sale that ended within this many hours leads with its results. */
  justEndedHours: 72,
  /** A sale opening within this many days leads the page. */
  upcomingDays: 60,
  /** A sale that ended within this many days leads with recent results. */
  recentResultsDays: 90,
  /** Ended sales within this many days feed the results band. */
  resultsBandDays: 365,
} as const;

export type HomeStateWindows = { [K in keyof typeof HOME_STATE_WINDOWS]: number };

export const homeStates = [
  "live",
  "justEnded",
  "upcoming",
  "recentResults",
  "betweenSeasons",
] as const;
export type HomeState = (typeof homeStates)[number];

export type HomeSectionId =
  | "inThisSale"
  | "highlightsFromNextSale"
  | "topLotsOfSale"
  | "comingUp"
  | "recentResults"
  | "departments"
  | "artists"
  | "selling"
  | "alerts"
  | "fromLaxAndPress";

/** The sections below the hero for each state, in page order. */
export const HOME_SECTION_ORDER: Readonly<Record<HomeState, readonly HomeSectionId[]>> = {
  live: ["inThisSale", "comingUp", "recentResults", "departments", "selling", "alerts"],
  justEnded: ["comingUp", "departments", "artists", "selling", "alerts"],
  upcoming: ["highlightsFromNextSale", "comingUp", "recentResults", "selling", "alerts"],
  recentResults: ["topLotsOfSale", "selling", "departments", "artists", "alerts"],
  betweenSeasons: ["recentResults", "selling", "departments", "artists", "fromLaxAndPress"],
};

export type HomeSaleFacts = {
  id: string;
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled";
  startTime: Date;
  endTime: Date;
};

export type HomeBidderApproval = "approved" | "pending" | "declined";

export type HomeViewer =
  | { signedIn: false }
  | {
      signedIn: true;
      approval: HomeBidderApproval;
      alertsOn: boolean;
      /** Followed artists with works in the lead sale. */
      followedArtistsInLeadSale: number;
    };

/** What replaces the register prompt. */
export type HomeRegisterSwap = "register" | "completeApproval" | "none";
/** What the alerts control shows. */
export type HomeAlertsSwap = "signUp" | "getAlerts" | "alertsOn";

export type HomeViewerSwaps = {
  register: HomeRegisterSwap;
  alerts: HomeAlertsSwap;
  /** Followed artists with works in the lead sale; 0 hides the line. */
  followedArtistsLine: number;
};

export type HomeStateInput = {
  sales: readonly HomeSaleFacts[];
  now: Date;
  /** Staff-pinned sale ids; a pin wins only among sales that are live. */
  pinnedSaleIds?: readonly string[];
  viewer?: HomeViewer;
  windows?: HomeStateWindows;
};

export type HomeStateResult = {
  state: HomeState;
  /** The sale that leads the hero, or null between seasons with nothing to show. */
  leadSaleId: string | null;
  /** Sections below the hero, in order. */
  sections: readonly HomeSectionId[];
  /** Scheduled sales at any distance, soonest first. */
  comingUpSaleIds: readonly string[];
  /** Sales ended within the results-band window, newest first. */
  resultsBandSaleIds: readonly string[];
  viewerSwaps: HomeViewerSwaps;
};

export function resolveHomeViewerSwaps(viewer: HomeViewer | undefined): HomeViewerSwaps {
  if (!viewer?.signedIn) return { register: "register", alerts: "signUp", followedArtistsLine: 0 };
  return {
    register: viewer.approval === "pending" ? "completeApproval" : "none",
    alerts: viewer.alertsOn ? "alertsOn" : "getAlerts",
    followedArtistsLine: Math.max(0, Math.floor(viewer.followedArtistsInLeadSale)),
  };
}

/** Removes sections that have nothing to show; the order is kept. */
export function pruneEmptyHomeSections(
  sections: readonly HomeSectionId[],
  hasContent: (section: HomeSectionId) => boolean,
): HomeSectionId[] {
  return sections.filter(hasContent);
}

function byTime(pick: (sale: HomeSaleFacts) => Date, direction: 1 | -1) {
  return (a: HomeSaleFacts, b: HomeSaleFacts) =>
    direction * (pick(a).getTime() - pick(b).getTime()) || a.id.localeCompare(b.id);
}

/** A staff pin wins among live sales; otherwise the soonest close. */
function pickLive(live: HomeSaleFacts[], pinned: ReadonlySet<string>): HomeSaleFacts | null {
  const bySoonestClose = [...live].sort(byTime((s) => s.endTime, 1));
  return bySoonestClose.find((s) => pinned.has(s.id)) ?? bySoonestClose[0] ?? null;
}

export function resolveHomeState(input: HomeStateInput): HomeStateResult {
  const w = input.windows ?? HOME_STATE_WINDOWS;
  const nowMs = input.now.getTime();
  const pinned = new Set(input.pinnedSaleIds ?? []);
  const sales = input.sales;

  const ageMs = (s: HomeSaleFacts) => Math.max(0, nowMs - s.endTime.getTime());
  const live = sales.filter((s) => s.status === "active");
  const scheduled = sales
    .filter((s) => s.status === "scheduled")
    .sort(byTime((s) => s.startTime, 1));
  const ended = sales.filter((s) => s.status === "ended").sort(byTime((s) => s.endTime, -1));

  const justEnded = ended.filter((s) => ageMs(s) <= w.justEndedHours * HOUR_MS);
  const upcoming = scheduled.filter(
    (s) => s.startTime.getTime() - nowMs <= w.upcomingDays * DAY_MS,
  );
  const recent = ended.filter((s) => ageMs(s) <= w.recentResultsDays * DAY_MS);
  const band = ended.filter((s) => ageMs(s) <= w.resultsBandDays * DAY_MS);

  let state: HomeState;
  let lead: HomeSaleFacts | null;
  const liveLead = pickLive(live, pinned);
  if (liveLead) {
    state = "live";
    lead = liveLead;
  } else if (justEnded[0]) {
    state = "justEnded";
    lead = justEnded[0];
  } else if (upcoming[0]) {
    state = "upcoming";
    lead = upcoming[0];
  } else if (recent[0]) {
    state = "recentResults";
    lead = recent[0];
  } else {
    state = "betweenSeasons";
    lead = band[0] ?? null;
  }

  return {
    state,
    leadSaleId: lead?.id ?? null,
    sections: HOME_SECTION_ORDER[state],
    comingUpSaleIds: scheduled.map((s) => s.id),
    resultsBandSaleIds: band.map((s) => s.id),
    viewerSwaps: resolveHomeViewerSwaps(input.viewer),
  };
}
