import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { SubmissionOverviewTab } from "@/components/admin/submission-detail/tabs/overview-tab";
import { getAdminCategoryList, getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function resolveSubmissionCategories(
  submission: NonNullable<Awaited<ReturnType<typeof getAdminSubmissionById>>>,
  allCategories: Awaited<ReturnType<typeof getAdminCategoryList>>,
) {
  const ids =
    submission.categoryIds && submission.categoryIds.length > 0
      ? submission.categoryIds
      : submission.categoryId
        ? [submission.categoryId]
        : [];
  const byId = new Map(allCategories.map((c) => [c.id, c.name]));
  return ids.map((id) => ({ id, name: byId.get(id) ?? id }));
}

export default async function AdminSubmissionOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await getAdminSubmissionById(id);
  if (!s) notFound();

  const categoryIds =
    s.categoryIds && s.categoryIds.length > 0 ? s.categoryIds : s.categoryId ? [s.categoryId] : [];

  const submitterLegalEntityId = s.legalEntityId ?? s.sellerId ?? null;
  const [submitterEntity, staffDocuments, allCategories] = await Promise.all([
    submitterLegalEntityId
      ? getAdminLegalEntityById(submitterLegalEntityId).catch(() => null)
      : Promise.resolve(null),
    getServerSubmissionDocuments(id),
    categoryIds.length > 0
      ? getAdminCategoryList({ includeArchived: true }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not update submission" />
      <SubmissionOverviewTab
        submission={s}
        documentCount={staffDocuments.length}
        submitterDisplayName={submitterEntity?.displayName ?? null}
        categories={resolveSubmissionCategories(s, allCategories)}
      />
    </>
  );
}
