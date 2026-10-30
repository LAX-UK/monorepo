"use client";

import { GuestErasureDialog } from "@/components/orders/guest-erasure-dialog.client";
import { GUEST_ERASURE_COPY, guestErasureMenuReason } from "@/server/domain/guest-erasure.vm";
import type { AdminGuestErasureState } from "@auction/shop-contracts";
import { OverflowMenu, toast } from "@auction/staff-ui";
import { Copy, Eraser, ExternalLink } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * A lead's actions: open the CRM record, copy the email, and, last and set apart, erase the
 * guest's data (Administrators only), which says why when it has to wait.
 */
export function LeadActions({
  leadId,
  email,
  crmUrl,
  erasure,
}: {
  leadId: string;
  email: string;
  /** The CRM record's page; null when the lead is not in the CRM or no CRM address is set. */
  crmUrl: string | null;
  /** Loaded only for people who may erase guest data. */
  erasure: AdminGuestErasureState | null;
}) {
  const router = useRouter();
  const [erasing, setErasing] = useState(false);
  return (
    <>
      <OverflowMenu
        actions={[
          ...(crmUrl
            ? [
                {
                  id: "crm",
                  label: "Open in CRM",
                  icon: ExternalLink,
                  onSelect: () => window.open(crmUrl, "_blank", "noopener"),
                },
              ]
            : []),
          {
            id: "copy",
            label: "Copy email",
            icon: Copy,
            onSelect: () => {
              void navigator.clipboard?.writeText(email).then(() => toast.success("Email copied"));
            },
          },
          ...(erasure
            ? [
                {
                  id: "erase-guest",
                  label: GUEST_ERASURE_COPY.menuItem,
                  icon: Eraser,
                  tone: "danger" as const,
                  requires: "lead.erase",
                  ...(erasure.allowed
                    ? {}
                    : {
                        disabledReason:
                          guestErasureMenuReason(erasure, undefined) ??
                          GUEST_ERASURE_COPY.unavailable,
                      }),
                  onSelect: () => setErasing(true),
                },
              ]
            : []),
        ]}
      />
      {erasure ? (
        <GuestErasureDialog
          open={erasing}
          onOpenChange={setErasing}
          guestCustomerId={leadId}
          email={email}
          onErased={() => router.push("/leads")}
        />
      ) : null}
    </>
  );
}
