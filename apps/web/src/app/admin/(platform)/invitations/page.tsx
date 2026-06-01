import {
  AdminBulkSelectionBar,
  AdminBulkSelectionProvider,
} from "@/components/admin/admin-bulk-selection-bridge";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminInvitationsBoard } from "@/components/admin/admin-invitations-board";
import { AdminInviteForm } from "@/components/admin/admin-invite-form";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { InvitationsMobileCards } from "@/components/admin/people/invitations-mobile-cards";
import { PeopleListShell } from "@/components/admin/people/people-list-shell";
import { invitationsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { PaginationFooter } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Invitations",
  "Invite staff or clients by email.",
);

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; limit?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = invitationsListController.parseQuery(sp);

  let rows: Awaited<ReturnType<typeof invitationsListController.fetch>>["rows"] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const result = await invitationsListController.fetch(query);
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load invitations.";
  }

  const pagination =
    !loadError && total > 0 ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        total={total}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/invitations", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/invitations", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    ) : null;

  const listSection =
    !loadError && total > 0 && rows.length > 0 ? (
      <>
        <div className="hidden lg:block">
          <AdminInvitationsBoard rows={rows} externalMobileCards />
        </div>
        <div className="lg:hidden">
          <InvitationsMobileCards rows={rows} />
        </div>
      </>
    ) : !loadError && total === 0 ? (
      <AdminEmptyState
        title="No invitations yet"
        description="Send an invite above — pending invitations will appear in this list."
      />
    ) : !loadError && rows.length === 0 ? (
      <AdminEmptyState
        title="No invitations on this page"
        description="Try a previous page or adjust pagination."
      />
    ) : null;

  return (
    <AdminBulkSelectionProvider>
      <PeopleListShell
        title="Invitations"
        description="Invite staff or clients by email. They complete signup with the link we send (or log in the server console in development)."
        wrapView={false}
        showCommandPaletteHint
        bulkBar={<AdminBulkSelectionBar />}
        mobileSummary={
          !loadError && total > 0 ? (
            <CatalogListMobileSummary
              metrics={[
                { id: "total", label: "Total invitations", value: String(total) },
                { id: "page", label: "On this page", value: String(rows.length) },
              ]}
            />
          ) : null
        }
        errorAlert={
          error || loadError ? (
            <AdminListAlert title="Could not load invitations">{loadError ?? error}</AdminListAlert>
          ) : null
        }
        view={
          !loadError ? (
            <div className="space-y-8">
              <Surface variant="card" className="border-border-hairline">
                <div className="space-y-1">
                  <h2 className="font-headline text-lg text-on-surface">Send invite</h2>
                  <p className="text-sm text-on-surface-variant">
                    Email and role are sent through the existing invitation action.
                  </p>
                </div>
                <AdminInviteForm />
              </Surface>
              <section className="space-y-4">
                <div className="space-y-1">
                  <h2 className="font-headline text-lg text-on-surface">Sent invitations</h2>
                  <p className="text-sm text-on-surface-variant">
                    {total > 0
                      ? `${total} invitation${total === 1 ? "" : "s"} total`
                      : "Pending and recent invitations"}
                  </p>
                </div>
                {listSection}
              </section>
            </div>
          ) : null
        }
        pagination={pagination}
      />
    </AdminBulkSelectionProvider>
  );
}
