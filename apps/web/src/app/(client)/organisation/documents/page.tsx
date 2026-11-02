import { DashboardErrorAlert } from "@/components/dashboard/primitives";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { AgreementDocuments } from "@/components/organisation-team/agreement-documents";
import { StatementDocuments } from "@/components/organisation-team/statement-documents";
import { OrganisationDocumentList } from "@/components/organisations/organisation-document-list";
import { OrganisationTabNoAccess } from "@/components/organisations/organisation-tab-no-access";
import { ListEmpty } from "@/components/workspace/list-states";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { listServerConsignmentAgreements } from "@/lib/data/http/consignment-agreements.server";
import { getServerStatements } from "@/lib/data/http/organisation-profile.server";
import { requireActiveOrganisationActor } from "@/lib/legal-entity/active-organisation.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { organisationHref } from "@/lib/navigation/client-routes";
import { requireOrganisationTab } from "@/lib/navigation/organisation-tabs";
import { agreementDocumentRows } from "@/lib/organisation-team/agreement-documents.vm";
import { statementDocumentRows } from "@/lib/organisation-team/statement-documents.vm";
import { loadOrganisationDocuments } from "@/lib/organisations/organisation-documents.server";
import { buildOrganisationDocumentsView } from "@/lib/organisations/organisation-documents.vm";
import { entityActorCan } from "@auction/domain";
import type { ConsignmentAgreement } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * The Documents tab: what LAX asked the organisation for, what it sent and where each one is,
 * its consignment agreements, and its payout statements (finance sees the statements only).
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

  const readsCheck = entityActorCan(actor, "entity.profile.read");
  const readsStatements = entityActorCan(actor, "entity.payouts.read");
  const [loaded, agreements, submissions, statements] = await Promise.all([
    readsCheck ? loadOrganisationDocuments(member.id) : null,
    readsCheck
      ? listServerConsignmentAgreements().catch((): ConsignmentAgreement[] => [])
      : ([] as ConsignmentAgreement[]),
    readsCheck
      ? getServerDataContainer()
          .then((c) => c.submissions.listMine({ limit: 100, offset: 0 }))
          .catch(() => [])
      : [],
    readsStatements ? getServerStatements(member.id).catch(() => null) : null,
  ]);
  const agreementRows = agreementDocumentRows(
    agreements,
    new Map(submissions.map((s) => [s.id, s.title])),
  );
  const statementRows = statements ? statementDocumentRows(member.id, statements) : null;
  if (loaded && !loaded.ok) {
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

  const view = loaded
    ? buildOrganisationDocumentsView({
        actor,
        status: entity?.status ?? member.status,
        organisationName: member.displayName,
        slots: loaded.slots,
        received: loaded.received,
        checkedOn: entity?.statusChangedAt ?? null,
      })
    : null;

  return (
    <div className="flex flex-col gap-8">
      {view ? (
        <>
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
              <ListEmpty
                illustration="ledger"
                title="No agreements yet"
                description={`When ${member.displayName} consigns a work, its agreement is kept here to download.`}
              />
            )}
          </section>
        </>
      ) : null}
      {readsStatements ? (
        <section aria-labelledby="statement-documents-heading" className="flex flex-col gap-3">
          <h2
            id="statement-documents-heading"
            className="font-lax-display text-lax-18 font-semibold text-lax-fg"
          >
            Payout statements
          </h2>
          {statementRows === null ? (
            <DashboardErrorAlert
              title="We couldn't load the statements"
              message="Something went wrong on our side. Try again in a moment."
            />
          ) : statementRows.length > 0 ? (
            <StatementDocuments rows={statementRows} />
          ) : (
            <ListEmpty
              illustration="ledger"
              title="No statements yet"
              description={`Each payout to ${member.displayName} comes with a statement of its lots and deductions. They're kept here to download.`}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
