import { StaffAccessReviewList } from "@/components/admin/people/staff-access-review-list";
import { loadStaffAccessReviewPage } from "@/lib/admin/people/load-staff-access-review-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Access review",
  "Every staff member's Bid roles, when each ends and when they last signed in.",
);

export default async function AdminStaffAccessReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const model = await loadStaffAccessReviewPage(search);
  return <StaffAccessReviewList model={model} search={search} />;
}
