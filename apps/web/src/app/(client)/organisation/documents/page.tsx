import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { AgreementDocuments } from "@/components/organisation-team/agreement-documents";
import { TeamListEmpty } from "@/components/organisation-team/team-list-states";
import { OrganisationDocumentList } from "@/components/organisations/organisation-document-list";
import { OrganisationTabNoAccess } from "@/components/organisations/organisation-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { listServerConsignmentAgreements } from "@/lib/data/http/consignment-agreements.server";
import { requireActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import { agreementDocumentRows } from "@/lib/organisation-team/agreement-documents.vm";
import { loadOrganisationDocuments } from "@/lib/organisations/organisation-documents.server";
import { buildOrganisationDocumentsView } from "@/lib/organisations/organisation-documents.vm";
import type { ConsignmentAgreement } from "@auction/types";
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

  const [loaded, agreements, submissions] = await Promise.all([
    loadOrganisationDocuments(member.id),
    listServerConsignmentAgreements().catch((): ConsignmentAgreement[] => []),
    getServerDataContainer()
      .then((c) => c.submissions.listMine({ limit: 100, offset: 0 }))
      .catch(() => []),
  ]);
  const agreementRows = agreementDocumentRows(
    agreements,
    new Map(submissions.map((s) => [s.id, s.title])),
  );
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
    <div className="flex flex-col gap-8">
      <section aria-labelledby="check-documents-heading" className="flex flex-col gap-3">
        <h2
          id="check-documents-heading"
          className="font-lax-display text-lax-18 font-semibold text-lax-fg"
        >
          Organisation check
        </h2>
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
      </section>
      <section aria-labelledby="agreement-documents-heading" className="flex flex-col gap-3">
        <h2
          id="agreement-documents-heading"
          className="font-lax-display text-lax-18 font-semibold text-lax-fg"
        >
          Consignment agreements
        </h2>
        {agreementRows.length > 0 ? (
          <AgreementDocuments rows={agreementRows} />
        ) : (
          <TeamListEmpty
            illustration="ledger"
            title="No agreements yet"
            description={`When ${member.displayName} consigns a work, its agreement is kept here to download.`}
          />
        )}
      </section>
    </div>
  );
}
