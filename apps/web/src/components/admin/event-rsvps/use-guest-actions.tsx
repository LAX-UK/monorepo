"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { resendOnsiteEventPass } from "@/lib/data/http/onsite-event-check-in.client";
import { notify } from "@/lib/ui/notify";
import type { OverflowAction } from "@auction/staff-ui";
import type { OnsiteEventRsvpAdminRow } from "@auction/types";
import { Copy, Mail } from "lucide-react";
import type { ReactNode } from "react";

export type GuestActionTarget = Pick<OnsiteEventRsvpAdminRow, "id" | "name" | "email">;

/**
 * What staff can do for a guest on an event's list, as `…` menu actions, and the confirm those
 * actions open. Resending a pass asks first: the guest receives an email, and an earlier pass
 * link may stop working.
 */
export function useGuestActions(slug: string): {
  actionsFor: (guest: GuestActionTarget) => OverflowAction[];
  dialogs: ReactNode;
} {
  const confirm = useStaffConfirm();

  const askToResend = (guest: GuestActionTarget) =>
    confirm.ask({
      title: `Resend ${guest.name}'s pass?`,
      description: `${guest.name} will get their entry pass by email at ${guest.email}. If the pass link was never saved, a new link is issued and the earlier one stops working.`,
      confirmLabel: "Resend pass",
      success: `Pass resent to ${guest.name}`,
      run: async () => {
        try {
          await resendOnsiteEventPass(slug, guest.id);
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : "The pass could not be resent.",
          };
        }
      },
    });

  const actionsFor = (guest: GuestActionTarget): OverflowAction[] => [
    { id: "resend", label: "Resend pass", icon: Mail, onSelect: () => askToResend(guest) },
    {
      id: "copy-email",
      label: "Copy email address",
      icon: Copy,
      onSelect: () => {
        void navigator.clipboard
          ?.writeText(guest.email)
          .then(() => notify.success("Email address copied"))
          .catch(() => notify.error("The email address could not be copied"));
      },
    },
  ];

  return { actionsFor, dialogs: confirm.dialog };
}
