import { CopyUuidButton } from "@/components/admin/copy-uuid-button";
import {
  LegalEntityArchiveForm,
  LegalEntityRejectForm,
} from "@/components/admin/legal-entity-destructive-forms";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { legalEntityLifecycleSimpleAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { legalEntityStatusToBadgeVariant } from "@/lib/admin/legal-entity-status-badge-variant";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import type { LegalEntityStatus } from "@auction/types";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
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
    <AppScreen className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-6 border-b border-outline-variant/15 pb-8 md:flex-row md:items-end md:justify-between">
        <PageHeader
          className="mb-0 border-0 pb-0"
          title={entity.displayName}
          description={`Legal entity · ${entity.kind} / ${entity.subkind}`}
        />
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/legal-entities">Back to lookup</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/impersonation">Impersonation</Link>
          </Button>
        </div>
      </div>

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

      <Card className="border-outline-variant/15">
        <CardHeader>
          <CardTitle className="font-headline text-lg">Status</CardTitle>
          <CardDescription>Verification state and identifiers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusBadge variant={legalEntityStatusToBadgeVariant(entity.status)} size="md">
            {entity.status.replaceAll("_", " ")}
          </StatusBadge>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-on-surface-variant">UUID</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-xs text-on-surface">{entity.id}</span>
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
                  ? `${entity.stripeConnectChargesEnabled ? "charges" : "no charges"} · ${entity.stripeConnectPayoutsEnabled ? "payouts" : "no payouts"}`
                  : "—"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-on-surface-variant">Updated</dt>
              <dd className="text-on-surface">{entity.updatedAt.toLocaleString("en-GB")}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {simple.length > 0 ? (
        <Card className="border-outline-variant/15">
          <CardHeader>
            <CardTitle className="font-headline text-lg">Lifecycle</CardTitle>
            <CardDescription>
              Each action updates status and writes a domain event in one transaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ) : null}

      {canReject ? (
        <Card className="border-outline-variant/15">
          <CardHeader>
            <CardTitle className="font-headline text-lg">Reject</CardTitle>
            <CardDescription>
              Sets status to rejected. Requires an audit reason (min. 3 characters) and typed
              confirmation <span className="font-mono text-on-surface">REJECT</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LegalEntityRejectForm legalEntityId={entity.id} />
          </CardContent>
        </Card>
      ) : null}

      {canArchive ? (
        <Card className="border-outline-variant/15">
          <CardHeader>
            <CardTitle className="font-headline text-lg">Archive</CardTitle>
            <CardDescription>
              Permanent terminal state. You will confirm by typing{" "}
              <span className="font-mono text-on-surface">ARCHIVE {entity.displayName}</span>{" "}
              exactly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LegalEntityArchiveForm legalEntityId={entity.id} displayName={entity.displayName} />
          </CardContent>
        </Card>
      ) : null}
    </AppScreen>
  );
}
