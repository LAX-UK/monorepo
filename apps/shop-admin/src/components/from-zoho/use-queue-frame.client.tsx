"use client";

import { useListNavigation } from "@/components/use-list-navigation.client";
import {
  ZOHO_QUEUE_TABS,
  ZOHO_QUEUE_TAB_LABEL,
  type ZohoQueueQuery,
  activeZohoTab,
  zohoQueueHref,
} from "@/server/domain/zoho-register.vm";
import { DataViews } from "@auction/staff-ui";

export const FROM_ZOHO_TITLE = "From Zoho";
export const FROM_ZOHO_DESCRIPTION =
  "Artworks Zoho sends to LAX, and where Zoho and LAX disagree. Catalogue details are edited in Zoho.";

/**
 * What the tabs share: list navigation that keeps the URL as the state, and the tab strip with
 * the count of each queue (the last check has none). "Link lax.art" is a one-off: it shows only
 * while some lax.art original is not linked to its Zoho record, and counts those.
 */
export function useQueueFrame(
  query: ZohoQueueQuery,
  counts: { new: number; decisions: number },
  unlinked = 0,
) {
  const { pending, navigate, Link: ListLink } = useListNavigation();
  const views = ZOHO_QUEUE_TABS.filter((id) => id !== "link" || unlinked > 0).map((id) => ({
    id,
    label: ZOHO_QUEUE_TAB_LABEL[id],
    href: zohoQueueHref({}, { tab: id === "new" ? null : id }),
    ...(id === "check" ? {} : { count: id === "link" ? unlinked : counts[id] }),
  }));
  return {
    pending,
    navigate,
    ListLink,
    views: <DataViews views={views} activeId={activeZohoTab(query)} Link={ListLink} />,
  };
}
