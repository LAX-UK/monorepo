"use client";

import type { RecordSwitchToastView } from "@/lib/navigation/record-switch-toast.vm";
import { SwitchBackToast } from "./switch-back-toast";

/**
 * "Opened in Northbank Gallery": a record link belonged to another account, so Bid switched to it.
 * The toast says so and offers "Back to Personal" (or the organisation the link came from).
 */
export function RecordSwitchToast({
  account,
  title,
  detail,
  backLabel,
  fromKind,
  fromAccountId,
}: RecordSwitchToastView) {
  return (
    <SwitchBackToast
      account={account}
      title={title}
      detail={detail}
      backLabel={backLabel}
      fromKind={fromKind}
      fromAccountId={fromAccountId}
      testId="record-switch-toast"
    />
  );
}
