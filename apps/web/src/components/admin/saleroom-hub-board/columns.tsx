"use client";

import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import { SaleroomHubSessionBadge } from "@/components/admin/saleroom-hub-board/saleroom-hub-session-badge";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import {
  type DataColumn,
  type OverflowAction,
  PrimaryCell,
  StaffDate,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { SaleDeliveryMode } from "@auction/types";
import { toRequiredIsoString } from "@auction/validators";
import { DoorOpen, UserCheck } from "lucide-react";
import Link from "next/link";

type Row = AdminSaleListRow;

function rowActions(row: Row): OverflowAction[] {
  return [
    {
      id: "console",
      label: "Open clerk console",
      icon: DoorOpen,
      href: `/admin/saleroom/${row.sale.id}`,
    },
    {
      id: "check-in",
      label: "Check in bidders",
      icon: UserCheck,
      href: `${saleDetailTabHref(row.sale.id, "registrations")}#check-in`,
    },
  ];
}

export function saleroomHubColumns(): DataColumn<Row>[] {
  return [
    {
      id: "sale",
      header: "Sale",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          href={`/admin/saleroom/${row.sale.id}`}
          Link={Link}
          secondary={deliveryModeShortLabel(row.sale.deliveryMode as SaleDeliveryMode)}
        >
          {row.sale.title}
        </PrimaryCell>
      ),
    },
    {
      id: "schedule",
      header: "Starts",
      width: "176px",
      mobile: "meta",
      truncate: false,
      cell: (row) => <StaffDate value={toRequiredIsoString(row.sale.startTime)} withTime />,
    },
    {
      id: "ends",
      header: "Ends",
      width: "176px",
      hideBelow: "lg",
      mobile: "hidden",
      truncate: false,
      cell: (row) => <StaffDate value={toRequiredIsoString(row.sale.endTime)} withTime />,
    },
    {
      id: "session",
      header: "Room",
      width: "120px",
      mobile: "badge",
      truncate: false,
      cell: (row) => <SaleroomHubSessionBadge saleId={row.sale.id} />,
    },
    {
      id: "status",
      header: "Sale status",
      width: "120px",
      mobile: "hidden",
      truncate: false,
      cell: (row) => {
        const status = staffStatus("sale", row.sale.status);
        return (
          <StatusBadge tone={status.tone} live={status.live ?? false}>
            {status.label}
          </StatusBadge>
        );
      },
    },
    rowActionsColumn<Row>({
      actions: rowActions,
      label: (row) => `Actions for ${row.sale.title}`,
      Link,
    }),
  ];
}
