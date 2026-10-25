"use client";

import {
  StaffBreadcrumbs as KitBreadcrumbs,
  type StaffBreadcrumb,
  type StaffLinkComponent,
} from "@auction/staff-ui";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

/** The kit breadcrumbs with the app's router links, usable from server components. */
export function StaffBreadcrumbs({ items }: { items: StaffBreadcrumb[] }) {
  return <KitBreadcrumbs items={items} Link={NextLink} />;
}
