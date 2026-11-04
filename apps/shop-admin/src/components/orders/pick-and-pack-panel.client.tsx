"use client";

import {
  ConfirmPrintDialog,
  type SwapTarget,
} from "@/components/orders/confirm-print-dialog.client";
import { SwapPrintDialog } from "@/components/orders/swap-print-dialog.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { markCertificateSent } from "@/server/application/print-fulfilment-actions.server";
import {
  type PackRowView,
  packProgress,
  packRowViews,
  presentCertificateStatus,
} from "@/server/domain/pick-and-pack.vm";
import type { AdminPickAndPack } from "@auction/shop-contracts";
import { MappedStatusBadge, OverflowMenu, Section, StaffButton } from "@auction/staff-ui";
import { PackageCheck, Replace, Send } from "@auction/staff-ui/icons";
import { useState } from "react";

/**
 * Pick and pack, for the prints of one order: where each print is, and whether it has been
 * checked against the order. A numbered print leaves packing only once it is confirmed. Staff who
 * cannot change fulfilment see the same facts without the actions.
 */
export function PickAndPackPanel({
  pack,
  canWrite,
  canSwapAcrossOwners,
}: {
  pack: AdminPickAndPack;
  canWrite: boolean;
  canSwapAcrossOwners: boolean;
}) {
  const rows = packRowViews(pack);
  if (rows.length === 0) return null;
  return (
    <Section title="Pick and pack" description={packProgress(rows)} bodyClassName="p-0">
      <ul className="divide-y divide-staff-line-subtle">
        {rows.map((row) => (
          <PackRow
            key={row.orderLineId}
            row={row}
            canWrite={canWrite}
            canSwapAcrossOwners={canSwapAcrossOwners}
          />
        ))}
      </ul>
    </Section>
  );
}

function PackRow({
  row,
  canWrite,
  canSwapAcrossOwners,
}: {
  row: PackRowView;
  canWrite: boolean;
  canSwapAcrossOwners: boolean;
}) {
  const action = useAdminAction();
  const [confirming, setConfirming] = useState(false);
  const [swap, setSwap] = useState<{ target: SwapTarget } | null>(null);
  const certificate = row.certificate;
  // Before packing, the note says what will happen; the badge is for what has.
  const showCertificate =
    certificate.status !== "none" && certificate.status !== "pending_confirmation";

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-staff-sm font-medium text-staff-fg">
            {row.title} <span className="tabular-nums text-staff-muted">· {row.label}</span>
          </p>
          <p className="text-staff-xs text-staff-muted">{row.where}</p>
          {row.confirmedNote ? (
            <p className="text-staff-xs text-staff-muted">{row.confirmedNote}</p>
          ) : null}
          {row.replacedNote ? (
            <p className="text-staff-xs text-staff-muted">{row.replacedNote}</p>
          ) : null}
          {certificate.note ? (
            <p
              className={
                certificate.status === "blocked"
                  ? "text-staff-xs text-staff-danger"
                  : "text-staff-xs text-staff-muted"
              }
            >
              {certificate.note}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showCertificate ? (
            <MappedStatusBadge status={certificate.status} present={presentCertificateStatus} />
          ) : null}
          {canWrite && certificate.status === "to_send" && certificate.certificateId ? (
            <StaffButton
              size="sm"
              variant="secondary"
              requires="fulfilment.write"
              icon={<Send aria-hidden />}
              loading={action.pending}
              aria-label={`Mark the certificate for ${row.label} as sent`}
              onClick={() =>
                action.run(
                  () =>
                    markCertificateSent({
                      certificateId: certificate.certificateId ?? "",
                      idempotencyKey: action.idempotencyKey,
                    }),
                  "Certificate marked as sent",
                )
              }
            >
              Mark sent
            </StaffButton>
          ) : null}
          {row.confirmed ? (
            <MappedStatusBadge
              status="confirmed"
              present={() => ({ label: "Confirmed", tone: "success" })}
            />
          ) : canWrite ? (
            <>
              <StaffButton
                size="sm"
                variant="secondary"
                requires="fulfilment.write"
                icon={<PackageCheck aria-hidden />}
                disabled={!row.canConfirm}
                aria-label={`Confirm the print for ${row.title}, ${row.label}`}
                onClick={() => setConfirming(true)}
              >
                Confirm print
              </StaffButton>
              <OverflowMenu
                label={`More actions for ${row.label}`}
                actions={[
                  {
                    id: "swap",
                    label: "Send another print",
                    icon: Replace,
                    requires: "fulfilment.write",
                    onSelect: () => setSwap({ target: null }),
                  },
                ]}
              />
            </>
          ) : null}
        </div>
      </div>
      {action.error}
      {confirming ? (
        <ConfirmPrintDialog
          row={row}
          open={confirming}
          onOpenChange={setConfirming}
          canSwapAcrossOwners={canSwapAcrossOwners}
          onSwap={(target) => setSwap({ target })}
        />
      ) : null}
      {swap ? (
        <SwapPrintDialog
          row={row}
          target={swap.target}
          open
          onOpenChange={(open) => {
            if (!open) setSwap(null);
          }}
        />
      ) : null}
    </li>
  );
}
