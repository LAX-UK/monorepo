import { CollectionsPage } from "@/components/admin/collections/collections-page";
import { loadCollectionsPage } from "@/lib/admin/collections/load-collections-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { COLLECTIONS_ACCESS, COLLECTIONS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { londonToday } from "@auction/staff-ui";
import type { UserRole } from "@auction/types";
import { userHasAccessTo } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Collections",
  "Who is coming to collect, and when. Hand over after checking photo ID.",
);

export default async function AdminCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminCapability(COLLECTIONS_READ_ACCESS, "/admin/collections");
  const canChange = userHasAccessTo(user.role as UserRole, user.staffRoles, COLLECTIONS_ACCESS);
  const today = londonToday();
  const model = await loadCollectionsPage(await searchParams, today);
  return <CollectionsPage {...model} canChange={canChange} today={today} />;
}
