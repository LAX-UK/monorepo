import { formatDateTimeShort } from "@/lib/ui/format";
import type { SellerIdentityReminderState } from "@auction/types";

export type IdentityReminderView = {
  /** Another reminder may go out now. */
  canSend: boolean;
  /** When the last one went out, and when the next may, for staff. */
  status: string | null;
};

/** "Remind the seller": whether it can be sent now and what to say about the last one. */
export function identityReminderView(
  state: SellerIdentityReminderState | undefined,
  now: Date,
): IdentityReminderView {
  if (!state?.lastSentAt) return { canSend: true, status: null };
  const last = `Last reminded ${formatDateTimeShort(state.lastSentAt, now)}.`;
  if (state.nextAllowedAt && now.getTime() < state.nextAllowedAt.getTime()) {
    return {
      canSend: false,
      status: `${last} You can send another from ${formatDateTimeShort(state.nextAllowedAt, now)}.`,
    };
  }
  return { canSend: true, status: last };
}
