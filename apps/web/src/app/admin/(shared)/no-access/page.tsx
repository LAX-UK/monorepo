import { findStaffNavItemForPath } from "@/components/layout/staff-nav";
import { loadNoAccessPage } from "@/lib/admin/load-no-access-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { AccessDeniedState, StaffButtonLink } from "@auction/staff-ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate("No access");

/**
 * Where a page this role cannot open sends people: it names the page, the roles that can open
 * it and a way back, so a shared link explains itself instead of bouncing silently.
 */
export default async function AdminNoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  const data = await loadNoAccessPage(from, findStaffNavItemForPath);
  if (!data) redirect("/login?next=/admin&auth=required");

  return (
    <AccessDeniedState
      headingLevel="h1"
      className="min-h-[60vh]"
      resource={data.resource}
      requiredRoles={data.roles}
      action={
        <StaffButtonLink variant="secondary" href={data.home} Link={Link}>
          Back to your overview
        </StaffButtonLink>
      }
    />
  );
}
