import {
  LegalEntityArchiveForm,
  LegalEntityRejectForm,
} from "@/components/admin/legal-entity-destructive-forms";
import { legalEntityLifecycleSimpleAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import type { LegalEntityStatus } from "@auction/types";
import { canAccessPlatformAdminRoutes, type UserRole } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { PageHeader } from "@auction/ui/components/page-header";
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

function statusBadgeClass(status: LegalEntityStatus): string {
  switch (status) {
    case "approved":
    case "connect_pending":
      return "bg-success/10 text-success";
    case "rejected":
    case "archived":
    case "restricted":
      return "bg-error/10 text-error";
    default:
      return "bg-surface-container text-on-surface-variant";
  }
}

export default async function AdminLegalEntityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireAuthenticatedUser({
    shell: "staff",
    loginNext: "/admin/legal-entities",
  });
  if (!canAccessPlatformAdminRoutes(user.role as UserRole)) {
    redirect("/admin");
  }

  const { id } = await params;
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const success = sp.success ? decodeURIComponent(sp.success) : null;

  let entity;
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
    <div className="screen mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={entity.displayName}
          description={`Legal entity · ${entity.kind} / ${entity.subkind}`}
        />
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/legal-entities">Back to lookup</Link>
        </Button>
      </div>

      {success ? (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not apply change</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-on-surface">Status</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(entity.status)}`}
          >
            {entity.status.replaceAll("_", " ")}
          </span>
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-on-surface-variant">UUID</dt>
            <dd className="font-mono text-xs text-on-surface">{entity.id}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Legal name</dt>
            <dd className="text-on-surface">{entity.legalName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Stripe Connect</dt>
            <dd className="text-on-surface">
              {entity.stripeConnectAccountId
                ? `${entity.stripeConnectChargesEnabled ? "charges" : "no charges"} · ${entity.stripeConnectPayoutsEnabled ? "payouts" : "no payouts"}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Updated</dt>
            <dd className="text-on-surface">{entity.updatedAt.toLocaleString("en-GB")}</dd>
          </div>
        </dl>
      </section>

      {simple.length > 0 ? (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-on-surface">Lifecycle</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Each action updates status and writes a domain event in one transaction.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
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
        </section>
      ) : null}

      {canReject ? (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-on-surface">Reject</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Sets status to rejected. Requires an audit reason (min. 3 characters) and typed
            confirmation <span className="font-mono text-on-surface">REJECT</span>.
          </p>
          <LegalEntityRejectForm legalEntityId={entity.id} />
        </section>
      ) : null}

      {canArchive ? (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-on-surface">Archive</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Permanent terminal state. You will confirm by typing{" "}
            <span className="font-mono text-on-surface">ARCHIVE {entity.displayName}</span> exactly.
          </p>
          <LegalEntityArchiveForm legalEntityId={entity.id} displayName={entity.displayName} />
        </section>
      ) : null}
    </div>
  );
}
