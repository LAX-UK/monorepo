import {
  LegalEntityArchiveForm,
  LegalEntityRejectForm,
} from "@/components/admin/legal-entity-destructive-forms";
import { legalEntityLifecycleSimpleAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { DangerZone, KeyValueList, Section, StaffButton, StaffDate } from "@auction/staff-ui";
import type { LegalEntity, LegalEntityStatus } from "@auction/types";

function simpleTransitionButtons(status: LegalEntityStatus): { op: string; label: string }[] {
  const out: { op: string; label: string }[] = [];
  if (status === "lead") out.push({ op: "request_docs", label: "Request documents" });
  if (status === "docs_received" || status === "under_review") {
    out.push({ op: "request_docs", label: "Request more documents" });
  }
  if (status === "docs_received") out.push({ op: "start_review", label: "Start review" });
  if (status === "under_review") out.push({ op: "approve", label: "Approve and move to Connect" });
  if (status === "approved") out.push({ op: "restrict", label: "Restrict" });
  return out;
}

type Props = {
  entity: LegalEntity;
};

/** Where the organisation is in its compliance lifecycle, the next steps, and the final ones. */
export function LegalEntityComplianceTab({ entity }: Props) {
  const simple = simpleTransitionButtons(entity.status);
  const canReject = entity.status !== "rejected" && entity.status !== "archived";
  const canArchive = entity.status !== "archived";
  const facts = [
    ...(entity.statusReason?.trim()
      ? [{ label: "Status reason", value: entity.statusReason.trim() }]
      : []),
    ...(entity.statusChangedAt
      ? [{ label: "Status changed", value: <StaffDate value={entity.statusChangedAt} withTime /> }]
      : []),
  ];

  return (
    <>
      <Section
        title="Compliance lifecycle"
        description="Each step changes the status and writes an audit event in one go."
      >
        <div className="flex flex-col gap-4">
          {facts.length > 0 ? <KeyValueList items={facts} /> : null}
          {simple.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {simple.map((b) => (
                <form key={b.op} action={legalEntityLifecycleSimpleAction}>
                  <input type="hidden" name="legalEntityId" value={entity.id} />
                  <input type="hidden" name="op" value={b.op} />
                  <StaffButton type="submit" variant="secondary" size="sm">
                    {b.label}
                  </StaffButton>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-staff-sm text-staff-muted">
              No lifecycle steps are available for this status.
            </p>
          )}
        </div>
      </Section>
      {canReject || canArchive ? (
        <DangerZone>
          {canReject ? (
            <div className="px-4 py-3.5">
              <p className="mb-3 text-staff-sm font-medium text-staff-fg">Reject</p>
              <LegalEntityRejectForm legalEntityId={entity.id} displayName={entity.displayName} />
            </div>
          ) : null}
          {canArchive ? (
            <div className="px-4 py-3.5">
              <p className="mb-3 text-staff-sm font-medium text-staff-fg">Archive</p>
              <LegalEntityArchiveForm legalEntityId={entity.id} displayName={entity.displayName} />
            </div>
          ) : null}
        </DangerZone>
      ) : null}
    </>
  );
}
