import { InvitationsStaffList } from "@/components/admin/people/invitations-staff-list";
import { peopleRangeSummary } from "@/lib/admin/people/clients-staff-list.vm";
import { toInvitationStaffRows } from "@/lib/admin/people/invitations-staff-list.vm";
import { loadAdminInvitationsListPage } from "@/lib/admin/people/load-invitations-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Invitations",
  "Invite staff or clients by email.",
);

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { model, rows, summary, total, loadError, pagination, selectedInvitation } =
    await loadAdminInvitationsListPage(sp);
  const offPage =
    selectedInvitation && !rows.some((row) => row.id === selectedInvitation.id)
      ? (toInvitationStaffRows([selectedInvitation])[0] ?? null)
      : null;

  return (
    <InvitationsStaffList
      rows={toInvitationStaffRows(rows)}
      search={sp}
      counts={summary}
      filterChips={model.activeFilterChips.map((chip) => ({
        id: chip.id,
        label: chip.label,
        clearHref: chip.clearHref,
      }))}
      pageSize={model.query.limit}
      pagination={
        rows.length > 0
          ? {
              summary: peopleRangeSummary(model.query.offset, rows.length, total, {
                one: "invitation",
                other: "invitations",
              }),
              prevHref: pagination?.prevHref ?? null,
              nextHref: pagination?.nextHref ?? null,
            }
          : null
      }
      offPage={offPage}
      loadError={loadError}
      filtered={Boolean(model.listFilters.q)}
    />
  );
}
