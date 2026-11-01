"use client";

import { TabNav, type TabNavItem } from "@auction/ui/lax";
import Link from "next/link";

/**
 * The consignment's sections as tabs (Overview, Messages, Documents), each a real address so it
 * can be shared and the back button works. The page picks the current one from the address.
 */
export function ConsignmentDetailTabs({
  items,
  activeId,
}: {
  items: readonly TabNavItem[];
  activeId: string;
}) {
  return <TabNav items={items} activeId={activeId} label="Consignment" Link={Link} />;
}
