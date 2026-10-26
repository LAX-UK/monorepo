"use client";

import { StaffDetailTabs } from "@/components/admin/staff/staff-detail-tabs";
import { usePinPageAction } from "@/components/admin/staff/use-pin-page-action";
import {
  venueDetailTabHref,
  venueEditHref,
} from "@/components/admin/venue-detail/venue-detail-types";
import { useVenueActions } from "@/components/admin/venues/use-venue-actions";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { VenueDetail } from "@/lib/services/interfaces/admin-venue-service";
import {
  DetailPage,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
  staffCellLinkClass,
} from "@auction/staff-ui";
import { Pencil } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  venueId: string;
  detail: VenueDetail;
  children: ReactNode;
};

/**
 * A venue's page on the staff record template: its name and whether it is active, who runs it and
 * where it is, Edit as the one primary action (an archived venue cannot be edited), archive in
 * the overflow menu, and its sections as tabs.
 */
export function VenueDetailShell({ venueId, detail, children }: Props) {
  const { venue, salesUsingCount, legalEntityDisplayName = null } = detail;
  const archived = venue.status === "archived";
  const status = staffStatus("venue", venue.status);
  const pin = usePinPageAction(venue.name);
  const venueActions = useVenueActions();
  const overflow: OverflowAction[] = [
    pin,
    ...venueActions.actionsFor({ id: venueId, name: venue.name, archived }),
  ];

  const tabs = [
    { id: "overview", label: "Overview", href: venueDetailTabHref(venueId, "overview") },
    {
      id: "sales",
      label: "Sales",
      href: venueDetailTabHref(venueId, "sales"),
      count: salesUsingCount,
    },
    { id: "activity", label: "Activity", href: venueDetailTabHref(venueId, "activity") },
  ];

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Venues", href: "/admin/venues" }, { label: venue.name }]}
          />
        }
        title={venue.name}
        status={
          <StatusBadge tone={status.tone} live={status.live ?? false}>
            {status.label}
          </StatusBadge>
        }
        meta={
          <>
            <MetaItem label="Organisation">
              {legalEntityDisplayName ? (
                <Link
                  href={`/admin/legal-entities/${venue.legalEntityId}`}
                  className={staffCellLinkClass}
                >
                  {legalEntityDisplayName}
                </Link>
              ) : (
                "Not known"
              )}
            </MetaItem>
            <MetaItem label="City">{venue.city}</MetaItem>
          </>
        }
        primaryAction={
          archived ? null : (
            <StaffButton asChild variant="primary" icon={<Pencil aria-hidden />}>
              <Link href={venueEditHref(venueId)}>Edit venue</Link>
            </StaffButton>
          )
        }
        overflow={<OverflowMenu label="More venue actions" Link={NextLink} actions={overflow} />}
        notice={
          archived ? (
            <Notice tone="info" title="This venue is archived">
              It cannot be edited or chosen for new sales. Sales already held there keep it.
            </Notice>
          ) : null
        }
        tabs={<StaffDetailTabs label="Venue sections" items={tabs} />}
      >
        {children}
      </DetailPage>
      {venueActions.dialogs}
    </>
  );
}
