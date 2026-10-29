import {
  CONSIGNMENT_STAGE_LABEL,
  type ReviewStage,
} from "@/lib/organisation-home/consignment-stage-links";
import {
  CONSIGNMENT_TABS,
  type ConsignmentTab,
  consignmentTabLabel,
} from "@/lib/seller/consignments.vm";

export type ConsignmentFilterChip = {
  id: ConsignmentTab;
  label: string;
  count: number;
  href: string;
  active: boolean;
};

export type ConsignmentsListView =
  /** Nothing consigned yet: the empty state, which carries "Sell a work" when the role may. */
  | { state: "empty"; headerAction: false; emptyAction: boolean; chips: null }
  /** Works exist but none match the filter: say so and offer to clear it. */
  | {
      state: "no-results";
      headerAction: boolean;
      chips: ConsignmentFilterChip[] | null;
      noResults: { title: string; description: string };
    }
  | { state: "list"; headerAction: boolean; chips: ConsignmentFilterChip[] | null };

type Input = {
  counts: Record<ConsignmentTab, number>;
  tab: ConsignmentTab;
  reviewStage: ReviewStage | null;
  /** Rows left after the filter. */
  shown: number;
  /** The role may hand in work for this account now. */
  canSell: boolean;
  path: string;
};

/**
 * What the Consignments list shows. One primary per screen: with no works the header action
 * goes and the empty state carries it. Filter chips appear only when they can narrow the list:
 * at least two stages hold works, or the person is already on a filter (so they can see it and
 * leave it). A chip with nothing in it is hidden, except "All" and the one the person is on.
 */
export function consignmentsListView({
  counts,
  tab,
  reviewStage,
  shown,
  canSell,
  path,
}: Input): ConsignmentsListView {
  if (counts.all === 0) {
    return { state: "empty", headerAction: false, emptyAction: canSell, chips: null };
  }
  const filled = CONSIGNMENT_TABS.filter((id) => id !== "all" && counts[id] > 0).length;
  const chips = filled < 2 && tab === "all" ? null : chipsFor(counts, tab, path);
  if (shown > 0) return { state: "list", headerAction: canSell, chips };
  const filterName = reviewStage ? CONSIGNMENT_STAGE_LABEL[reviewStage] : consignmentTabLabel(tab);
  return {
    state: "no-results",
    headerAction: canSell,
    chips,
    noResults: {
      title: `No consignments match “${filterName}”`,
      description: "Nothing has reached this stage yet. Clear the filter to see every work.",
    },
  };
}

function chipsFor(
  counts: Record<ConsignmentTab, number>,
  tab: ConsignmentTab,
  path: string,
): ConsignmentFilterChip[] {
  return CONSIGNMENT_TABS.filter((id) => id === "all" || id === tab || counts[id] > 0).map(
    (id) => ({
      id,
      label: consignmentTabLabel(id),
      count: counts[id],
      href: id === "all" ? path : `${path}?tab=${id}`,
      active: id === tab,
    }),
  );
}
