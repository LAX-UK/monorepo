import { DetailBoardShell } from "@/components/admin/catalog/detail-board";
import {
  LegalEntityArchiveForm,
  LegalEntityRejectForm,
} from "@/components/admin/legal-entity-destructive-forms";
import { legalEntityLifecycleSimpleAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { formatDateTime } from "@/lib/ui/format";
import type { LegalEntity, LegalEntityStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";

function simpleTransitionButtons(status: LegalEntityStatus): { op: string; label: string }[] {
  const out: { op: string; label: string }[] = [];
  if (status === "lead") out.push({ op: "request_docs", label: "Request documents" });
  if (status === "docs_received" || status === "under_review") {
    out.push({ op: "request_docs", label: "Request more documents" });
  }
  if (status === "docs_received") out.push({ op: "start_review", label: "Start review" });
  if (status === "under_review") out.push({ op: "approve", label: "Approve → Connect pending" });
  if (status === "approved") out.push({ op: "restrict", label: "Restrict" });
  return out;
}

type Props = {
  entity: LegalEntity;
};

export function LegalEntityComplianceTab({ entity }: Props) {
  const simple = simpleTransitionButtons(entity.status);
  const canReject = entity.status !== "rejected" && entity.status !== "archived";
  const canArchive = entity.status !== "archived";

  return (
    <div className="space-y-6">
      <DetailBoardShell
        title="Compliance lifecycle"
        description="Status transitions and destructive actions for this organisation."
      >
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
                  <dd className="text-on-surface">{formatDateTime(entity.statusChangedAt)}</dd>
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
            <div className="space-y-3 border-t border-shell-stroke pt-6">
              <div className="space-y-1">
                <h3 className="font-headline text-lg font-semibold text-on-surface">Reject</h3>
                <p className="font-body text-sm text-on-surface-variant">
                  Requires audit reason and typed confirmation{" "}
                  <span className="font-mono text-on-surface">REJECT</span>.
                </p>
              </div>
              <LegalEntityRejectForm legalEntityId={entity.id} />
            </div>
          ) : null}
          {canArchive ? (
            <div className="space-y-3 border-t border-shell-stroke pt-6">
              <div className="space-y-1">
                <h3 className="font-headline text-lg font-semibold text-on-surface">Archive</h3>
                <p className="font-body text-sm text-on-surface-variant">
                  Permanent terminal state. Confirm by typing{" "}
                  <span className="font-mono text-on-surface">ARCHIVE {entity.displayName}</span>{" "}
                  exactly.
                </p>
              </div>
              <LegalEntityArchiveForm legalEntityId={entity.id} displayName={entity.displayName} />
            </div>
          ) : null}
        </div>
      </DetailBoardShell>
    </div>
  );
}
