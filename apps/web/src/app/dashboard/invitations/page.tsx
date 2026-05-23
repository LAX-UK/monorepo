import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { InvitationCardList } from "@/components/organisations/invitation-card-list";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  buildDashboardSliceFailure,
  parseApiErrorCode,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { Button } from "@auction/ui/components/button";
import { Inbox } from "lucide-react";
import Link from "next/link";

export default async function InvitationsInboxPage() {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/invitations",
  });

  let loadFailure: DashboardSliceFailure | null = null;
  let pending: PendingInvitationRow[] = [];

  try {
    const res = await authedServerFetch("/legal-entities/invitations/mine", { cache: "no-store" });
    if (!res.ok) {
      const code = await parseApiErrorCode(res);
      loadFailure = buildDashboardSliceFailure("invitations", res.status, code);
    } else {
      const body = (await res.json()) as { data: PendingInvitationRow[] };
      pending = body.data ?? [];
    }
  } catch {
    loadFailure = buildDashboardSliceFailure("invitations", 500, null);
  }

  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl space-y-8">
        <DashboardPageHeader
          meta="Invitation"
          title="Invitations"
          description="Pending organisation invitations for your account email."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={DASHBOARD_ROUTES.organisations} prefetch>
                Back to organisations
              </Link>
            </Button>
          }
        />

        {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}

        {!loadFailure && pending.length === 0 ? (
          <DashboardEmptyState
            variant="hero"
            icon={<Inbox className="size-6" aria-hidden />}
            title={DASHBOARD_EMPTY.invitations.title}
            description={DASHBOARD_EMPTY.invitations.description}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={DASHBOARD_ROUTES.organisations} prefetch>
                  Go to Organisations
                </Link>
              </Button>
            }
          />
        ) : null}

        {!loadFailure && pending.length > 0 ? <InvitationCardList invitations={pending} /> : null}
      </div>
    </DashboardPage>
  );
}
