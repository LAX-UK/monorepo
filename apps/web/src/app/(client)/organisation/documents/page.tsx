import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { OrganisationDocumentList } from "@/components/organisations/organisation-document-list";
import { OrganisationTabNoAccess } from "@/components/organisations/organisation-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { requireActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import { loadOrganisationDocuments } from "@/lib/organisations/organisation-documents.server";
import { buildOrganisationDocumentsView } from "@/lib/organisations/organisation-documents.vm";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * The Documents tab: what LAX asked the organisation for, what it sent and where each one is.
 * The organisation's state banner comes from the layout, so this page does not repeat it.
 */
export default async function OrganisationDocumentsPage() {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: organisationHref("documents"),
  });
  const { organisation, actor } = await requireActiveOrganisationActor(user);
  const access = requireOrganisationTab(actor, "documents");
  if (access.kind === "forbidden") return <OrganisationTabNoAccess access={access} />;
  const ctx = await createPerOrgGateway().getContext(organisation.id);
  if (!ctx) notFound();
  const { member, entity } = ctx;

  const loaded = await loadOrganisationDocuments(member.id);
  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <DashboardErrorAlert
          title="We couldn't load the documents"
          message="Something went wrong on our side. Try again in a moment."
        >
          <div>
            <Button asChild variant="secondary" size="default">
              <Link href={organisationHref("documents")}>Try again</Link>
            </Button>
          </div>
        </DashboardErrorAlert>
      </div>
    );
  }

  const view = buildOrganisationDocumentsView({
    actor,
    status: entity?.status ?? member.status,
    organisationName: member.displayName,
    slots: loaded.slots,
    received: loaded.received,
  });

  return (
    <div className="space-y-6">
      {view.empty ? (
        <DashboardEmptyState
          illustration="ledger"
          title={view.empty.title}
          description={view.empty.description}
        />
      ) : (
        <OrganisationDocumentList
          entityId={member.id}
          intro={view.intro}
          rows={view.rows}
          closedNote={view.closedNote}
        />
      )}
    </div>
  );
}
