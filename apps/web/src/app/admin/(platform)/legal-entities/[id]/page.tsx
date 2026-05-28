import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminStripeConnectActions } from "@/components/admin/admin-stripe-connect-actions";
import { CopyUuidButton } from "@/components/admin/copy-uuid-button";
import {
  LegalEntityArchiveForm,
  LegalEntityRejectForm,
} from "@/components/admin/legal-entity-destructive-forms";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import { legalEntityLifecycleSimpleAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { labelForRequirement } from "@auction/connect";
import type { LegalEntityStatus } from "@auction/types";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

function simpleTransitionButtons(status: LegalEntityStatus): { op: string; label: string }[] {
  const out: { op: string; label: string }[] = [];
  if (status === "lead") {
    out.push({ op: "request_docs", label: "Request documents" });
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

export default async function AdminLegalEntityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; tab?: string }>;
}) {
  const user = await requireAuthenticatedUser({
    shell: "staff",
    loginNext: "/admin/legal-entities",
  });
  if (!canAccessPlatformAdminRoutes(user.role as UserRole, user.staffRole ?? null)) {
    redirect("/admin");
  }

  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const success = sp.success ? decodeURIComponent(sp.success) : null;
  const activeTab =
    sp.tab === "stripe" || sp.tab === "lifecycle" || sp.tab === "activity" ? sp.tab : "overview";

  let entity: Awaited<ReturnType<typeof getAdminLegalEntityById>> = null;
  try {
    entity = await getAdminLegalEntityById(id);
  } catch {
    notFound();
  }
  if (!entity) {
    notFound();
  }

  const simple = simpleTransitionButtons(entity.status);
  const canReject = entity.status !== "rejected" && entity.status !== "archived";
  const canArchive = entity.status !== "archived";

  return (
    <AdminEntityDetailShell
      detailHeader
      className="max-w-3xl space-y-6"
      breadcrumbs={
        <Link
          href="/admin/legal-entities"
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Legal entities
        </Link>
      }
      title={entity.displayName}
      description={`Legal entity · ${entity.kind} / ${entity.subkind}`}
      meta={<AdminStatusBadge domain="legalEntity" status={entity.status} size="md" />}
      actions={
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/legal-entities">Back to lookup</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/impersonation">Impersonation</Link>
          </Button>
        </div>
      }
    >
      {success ? (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Could not apply change</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <AdminDetailTabs
        defaultValue={activeTab}
        syncUrl
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <Surface variant="card" className="border-border-hairline">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">UUID</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono text-xs text-on-surface">
                        {entity.id}
                      </span>
                      <CopyUuidButton text={entity.id} />
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">Legal name</dt>
                    <dd className="text-on-surface">{entity.legalName ?? "—"}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">Stripe Connect</dt>
                    <dd className="text-on-surface">
                      {entity.stripeConnectAccountId
                        ? entity.stripeConnectPayoutsEnabled
                          ? "Payouts enabled"
                          : "Payout setup in progress"
                        : "—"}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">Updated</dt>
                    <dd className="text-on-surface">{formatDateTime(entity.updatedAt)}</dd>
                  </div>
                </dl>
              </Surface>
            ),
          },
          {
            value: "stripe",
            label: "Stripe",
            content: (
              <Surface variant="card" className="border-border-hairline">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">Connect account</dt>
                    <dd className="break-all font-mono text-xs text-on-surface">
                      {entity.stripeConnectAccountId ?? "—"}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-on-surface-variant">Payouts enabled</dt>
                    <dd className="text-on-surface">
                      {entity.stripeConnectPayoutsEnabled ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-on-surface-variant">Currently due requirements</dt>
                    <dd className="text-on-surface">
                      {entity.stripeConnectRequirementsCurrentlyDue.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {entity.stripeConnectRequirementsCurrentlyDue.map((req) => {
                            const label = labelForRequirement(req);
                            return (
                              <li key={req} className="text-sm">
                                <span className="font-medium">{label.label}</span>
                                <span className="block text-xs text-on-surface-variant">
                                  {label.hint}
                                </span>
                                <span className="font-mono text-[10px] text-on-surface-variant">
                                  {req}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        "None outstanding"
                      )}
                    </dd>
                  </div>
                </dl>
                <AdminStripeConnectActions entity={entity} />
              </Surface>
            ),
          },
          {
            value: "lifecycle",
            label: "Lifecycle",
            content: (
              <div className="space-y-4">
                {simple.length > 0 ? (
                  <Surface variant="card" className="border-border-hairline">
                    <p className="mb-3 font-body text-sm text-on-surface-variant">
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
                  </Surface>
                ) : (
                  <p className="font-body text-sm text-on-surface-variant">
                    No lifecycle transitions available for this status.
                  </p>
                )}
                {canReject ? (
                  <Surface variant="card" className="border-border-hairline">
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
                  </Surface>
                ) : null}
                {canArchive ? (
                  <Surface variant="card" className="border-border-hairline">
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
                  </Surface>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </AdminEntityDetailShell>
  );
}
