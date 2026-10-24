import { StaffBreadcrumbs, type StaffLinkComponent } from "@auction/staff-ui";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

/** Trail from a detail page back to its list; the last crumb is the page itself. */
export function AdminBreadcrumbs({
  list,
  current,
}: {
  list: { label: string; href: string };
  current: string;
}) {
  return (
    <StaffBreadcrumbs
      Link={NextLink}
      items={[{ label: list.label, href: list.href }, { label: current }]}
    />
  );
}
