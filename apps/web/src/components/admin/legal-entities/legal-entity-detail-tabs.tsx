import { AdminEntityTabPanel } from "@/components/admin/admin-entity-tab-panel";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminStaffLabeledField } from "@/components/admin/admin-staff-labeled-field";
import { AdminStripeConnectActions } from "@/components/admin/admin-stripe-connect-actions";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { CatalogDomainEventsTimeline } from "@/components/admin/catalog/catalog-domain-events-timeline";
import { LegalEntityDocumentsTab } from "@/components/admin/legal-entities/legal-entity-documents-tab";
import { LegalEntityHealthPanel } from "@/components/admin/legal-entities/legal-entity-health-panel";
import {
  LegalEntityArchiveForm,
  LegalEntityRejectForm,
} from "@/components/admin/legal-entity-destructive-forms";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import { buildLegalEntityHealthVM } from "@/lib/admin/legal-entity-health";
import { legalEntityLifecycleSimpleAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { formatLegalEntityKindSubkind } from "@/lib/admin/legal-entity-list-presenter";
import {
  collectStripeTechnicalIds,
  presentStripeConnectAccount,
  presentStripeDisabledReason,
  presentStripeRequirementsForEntity,
  stripeRequirementsAttentionCountForEntity,
} from "@/lib/admin/stripe-connect-staff-presenter";
import type { AdminDomainEventRow } from "@/lib/data/http/admin-audit.schema";
import type { AdminLegalEntityDocument } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import type { LegalEntity, LegalEntityStatus } from "@auction/types";
import { Badge } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

/**
 * Staff detail contract (see admin-list-shell.tsx): human-readable fields in `<dl>`;
 * UUIDs and Stripe reference ids via AdminTechnicalIdDisclosure.
 */

function simpleTransitionButtons(status: LegalEntityStatus): { op: string; label: string }[] {
  const out: { op: string; label: string }[] = [];
  if (status === "lead") {
    out.push({ op: "request_docs", label: "Request documents" });
  }
  if (status === "docs_received" || status === "under_review") {
    out.push({ op: "request_docs", label: "Request more documents" });
  }
  if (status === "docs_received") {
    out.push({ op: "start_review", label: "Start review" });
  }
  if (status === "under_review") {
    out.push({ op: "approve", label: "Approve → Connect pending" });
  }
  if (status === "approved") {
    out.push({ op: "restrict", label: "Restrict" });
  }
  return out;
}

type CreatorInfo = {
  id: string;
  name: string;
  email: string;
} | null;

type Props = {
  entity: LegalEntity;
  creator: CreatorInfo;
  activeTab: string;
  documents?: AdminLegalEntityDocument[];
  activityEvents?: AdminDomainEventRow[];
  error?: string | null;
  success?: string | null;
};

export function LegalEntityDetailTabs({
  entity,
  creator,
  activeTab,
  documents = [],
  activityEvents = [],
  error,
  success,
}: Props) {
  const simple = simpleTransitionButtons(entity.status);
  const pendingDocCount = documents.filter((d) => d.reviewStatus === "pending").length;
  const canReject = entity.status !== "rejected" && entity.status !== "archived";
  const canArchive = entity.status !== "archived";
  const stripeRequirementItems = presentStripeRequirementsForEntity(entity);
  const stripeDueCount = stripeRequirementsAttentionCountForEntity(entity);
  const health = buildLegalEntityHealthVM(entity);
  const stripeAccount = presentStripeConnectAccount(entity.stripeConnectAccountId);
  const disabledReasonRef = presentStripeDisabledReason(entity.stripeConnectDisabledReason);
  const stripeTechnicalIds = collectStripeTechnicalIds(entity);

  return (
    <>
      {success ? (
        <AdminListAlert title="Done" variant="default">
          {success}
        </AdminListAlert>
      ) : null}
      {error ? <AdminListAlert title="Could not apply change">{error}</AdminListAlert> : null}

      <AdminDetailTabs
        defaultValue={activeTab}
        syncUrl
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <AdminEntityTabPanel>
                <div className="space-y-6">
                  <LegalEntityHealthPanel health={health} />
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <div className="space-y-1">
                      <dt className="text-on-surface-variant">Legal name</dt>
                      <dd className="text-on-surface">{entity.legalName ?? "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-on-surface-variant">Created by</dt>
                      <dd className="text-on-surface">
                        {creator ? (
                          <Link
                            href={`/admin/clients/${creator.id}`}
                            className="text-link underline-offset-2 hover:underline"
                          >
                            {creator.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {creator?.email ? (
                          <span className="mt-0.5 block text-xs text-on-surface-variant">
                            {creator.email}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-on-surface-variant">Stripe Connect</dt>
                      <dd className="text-on-surface">
                        {stripeAccount ? (
                          <AdminStaffLabeledField
                            primary={stripeAccount.primary}
                            secondary={
                              entity.stripeConnectPayoutsEnabled
                                ? "Payouts enabled"
                                : "Payout setup in progress"
                            }
                          />
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-on-surface-variant">Updated</dt>
                      <dd className="text-on-surface">{formatDateTime(entity.updatedAt)}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-on-surface-variant">Kind</dt>
                      <dd className="text-on-surface">
                        {formatLegalEntityKindSubkind(entity.kind, entity.subkind)}
                      </dd>
                    </div>
                  </dl>
                  <AdminTechnicalIdDisclosure
                    items={[
                      { label: "Legal entity ID", value: entity.id, copyLabel: "Legal entity ID" },
                    ]}
                  />
                </div>
              </AdminEntityTabPanel>
            ),
          },
          {
            value: "documents",
            label: "Documents",
            badge:
              pendingDocCount > 0 ? (
                <Badge variant="secondary" className="ml-1.5 font-mono text-[10px]">
                  {pendingDocCount}
                </Badge>
              ) : undefined,
            content: (
              <LegalEntityDocumentsTab
                legalEntityId={entity.id}
                documents={documents}
                {...(error != null ? { error } : {})}
                {...(success != null ? { success } : {})}
              />
            ),
          },
          {
            value: "stripe",
            label: "Stripe",
            badge:
              stripeDueCount > 0 ? (
                <Badge variant="secondary" className="ml-1.5 font-mono text-[10px]">
                  {stripeDueCount}
                </Badge>
              ) : undefined,
            content: (
              <AdminEntityTabPanel>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">Connect account</dt>
                    <dd className="text-on-surface">
                      {stripeAccount ? (
                        <AdminStaffLabeledField
                          primary={stripeAccount.primary}
                          {...(stripeAccount.secondary
                            ? { secondary: stripeAccount.secondary }
                            : {})}
                        />
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">Charges enabled</dt>
                    <dd className="text-on-surface">
                      {entity.stripeConnectChargesEnabled ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">Payouts enabled</dt>
                    <dd className="text-on-surface">
                      {entity.stripeConnectPayoutsEnabled ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-on-surface-variant">Disabled reason</dt>
                    <dd className="text-on-surface">
                      {disabledReasonRef ? (
                        <AdminStaffLabeledField
                          primary={disabledReasonRef.primary}
                          {...(disabledReasonRef.secondary
                            ? { secondary: disabledReasonRef.secondary }
                            : {})}
                        />
                      ) : (
                        "None"
                      )}
                    </dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-on-surface-variant">Currently due requirements</dt>
                    <dd className="text-on-surface">
                      {stripeRequirementItems.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {stripeRequirementItems.map((label) => (
                            <li key={label.technicalValue ?? label.primary}>
                              <AdminStaffLabeledField
                                primary={label.primary}
                                {...(label.secondary ? { secondary: label.secondary } : {})}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "None outstanding"
                      )}
                    </dd>
                  </div>
                </dl>
                <AdminStripeConnectActions entity={entity} />
                <AdminTechnicalIdDisclosure items={stripeTechnicalIds} />
              </AdminEntityTabPanel>
            ),
          },
          {
            value: "lifecycle",
            label: "Lifecycle",
            content: (
              <AdminEntityTabPanel>
                <div className="space-y-6">
                  {entity.statusReason?.trim() || entity.statusChangedAt ? (
                    <dl className="grid gap-4 text-sm sm:grid-cols-2">
                      {entity.statusReason?.trim() ? (
                        <div className="space-y-1 sm:col-span-2">
                          <dt className="text-on-surface-variant">Status reason</dt>
                          <dd className="text-on-surface">{entity.statusReason.trim()}</dd>
                        </div>
                      ) : null}
                      {entity.statusChangedAt ? (
                        <div className="space-y-1">
                          <dt className="text-on-surface-variant">Status changed</dt>
                          <dd className="text-on-surface">
                            {formatDateTime(entity.statusChangedAt)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                  {simple.length > 0 ? (
                    <div className="space-y-3">
                      <p className="font-body text-sm text-on-surface-variant">
                        Each action updates status and writes a domain event in one transaction.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {simple.map((b) => (
                          <form key={b.op} action={legalEntityLifecycleSimpleAction}>
                            <input type="hidden" name="legalEntityId" value={entity.id} />
                            <input type="hidden" name="op" value={b.op} />
                            <Button type="submit" variant="secondary" size="sm">
                              {b.label}
                            </Button>
                          </form>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="font-body text-sm text-on-surface-variant">
                      No lifecycle transitions available for this status.
                    </p>
                  )}
                  {canReject ? (
                    <div className="space-y-3 border-t border-border-hairline pt-6">
                      <div className="space-y-1">
                        <h3 className="font-headline text-lg font-semibold text-on-surface">
                          Reject
                        </h3>
                        <p className="font-body text-sm text-on-surface-variant">
                          Requires audit reason and typed confirmation{" "}
                          <span className="font-mono text-on-surface">REJECT</span>.
                        </p>
                      </div>
                      <LegalEntityRejectForm legalEntityId={entity.id} />
                    </div>
                  ) : null}
                  {canArchive ? (
                    <div className="space-y-3 border-t border-border-hairline pt-6">
                      <div className="space-y-1">
                        <h3 className="font-headline text-lg font-semibold text-on-surface">
                          Archive
                        </h3>
                        <p className="font-body text-sm text-on-surface-variant">
                          Permanent terminal state. Confirm by typing{" "}
                          <span className="font-mono text-on-surface">
                            ARCHIVE {entity.displayName}
                          </span>{" "}
                          exactly.
                        </p>
                      </div>
                      <LegalEntityArchiveForm
                        legalEntityId={entity.id}
                        displayName={entity.displayName}
                      />
                    </div>
                  ) : null}
                </div>
              </AdminEntityTabPanel>
            ),
          },
          {
            value: "activity",
            label: "Activity",
            content: (
              <AdminEntityTabPanel>
                <div className="space-y-4">
                  <p className="font-body text-sm text-on-surface-variant">
                    Timeline of lifecycle, Stripe Connect, and membership events for this
                    organisation.
                  </p>
                  <CatalogDomainEventsTimeline
                    events={activityEvents}
                    exportFilters={{ aggregateType: "legal_entity", aggregateId: entity.id }}
                    showTechnicalDetails={false}
                  />
                </div>
              </AdminEntityTabPanel>
            ),
          },
        ]}
      />
    </>
  );
}
