import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { documentReviewStatusBadgeVariant } from "@/components/organisations/labels";
import { OrgTabSectionHeader } from "@/components/organisations/org-tab-section-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import type { LegalEntity, LegalEntityDocument } from "@auction/types";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { SectionHeader } from "@auction/ui/components/section-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

type EntityWithDocs = LegalEntity & { documents?: LegalEntityDocument[] };

function formatUploadedAt(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function OrganisationDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/organisations/${id}/documents`,
  });
  const ctx = await createPerOrgGateway().getContext(id);
  if (!ctx) notFound();

  const entity = ctx.entity as EntityWithDocs | null;
  const docs = entity?.documents ?? [];
  const returnTo = `/dashboard/organisations/${id}/documents`;
  const href = `/onboarding/organisation/step/documents?entityId=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="space-y-6">
      <OrgTabSectionHeader>
        <SectionHeader
          kicker={<LabelCaps>KYB</LabelCaps>}
          heading={<DisplayHeading as="h2">Documents</DisplayHeading>}
        />
      </OrgTabSectionHeader>

      <Surface variant="section" padding="md" className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-on-surface">Verification files</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Upload or replace documents in the secure onboarding step. When the API returns a
            document list, it appears here.
          </p>
        </div>
        <div>
          {docs.length === 0 ? (
            <DashboardEmptyState
              icon={<FileText className="size-6" aria-hidden />}
              title="No documents yet"
              description="Use onboarding to add KYB files for this organisation."
              action={
                <Button asChild variant="cta" size="sm">
                  <Link href={href} prefetch>
                    Upload documents
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-outline-variant/15 rounded-lg border border-border-hairline">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium capitalize">{doc.kind.replace(/_/g, " ")}</p>
                    <p className="text-xs text-on-surface-variant">
                      Uploaded {formatUploadedAt(doc.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      variant={documentReviewStatusBadgeVariant(doc.reviewStatus)}
                      size="sm"
                    >
                      {doc.reviewStatus}
                    </StatusBadge>
                    <Button asChild variant="outline" size="sm">
                      <Link href={href} prefetch>
                        Replace
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {docs.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="cta" size="sm">
              <Link href={href} prefetch>
                Upload more
              </Link>
            </Button>
          </div>
        ) : null}
      </Surface>
    </div>
  );
}
