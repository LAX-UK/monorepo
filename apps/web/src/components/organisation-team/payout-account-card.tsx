import type { PayoutAccountView } from "@/lib/data/http/organisation-profile.types";
import { payoutBankLineWithCurrency } from "@/lib/organisation-team/payout-bank-account.vm";
import { StatusBadge } from "@auction/ui/lax";
import { Landmark } from "lucide-react";
import { SettingsCard, SettingsRow } from "./settings-section";

type Props = {
  view: PayoutAccountView;
  /** "Changed 28 Oct 2026 by Daniel Reyes", for the people who read Activity. */
  changedLine: string | null;
  /** Why this member can't change it; `null` for those who can (they use the setup below). */
  readOnlyNote: string | null;
};

const STATUS = {
  ready: { tone: "success", shape: "check", label: "Ready" },
  failed: { tone: "danger", shape: "alert", label: "Needs replacing" },
} as const;

/**
 * Where the organisation's money goes: the bank, the last four digits and the currency, with
 * whether payouts can be sent to it. Only a summary ever reaches the page.
 */
export function PayoutAccountCard({ view, changedLine, readOnlyNote }: Props) {
  if (view.state !== "ready") {
    if (view.state !== "unavailable") return null;
    return (
      <SettingsCard>
        <SettingsRow
          label="Bank account"
          value="We can't show the bank account just now. Try again in a moment."
          muted
        />
      </SettingsCard>
    );
  }
  const { account } = view;
  const status = STATUS[account.status];
  return (
    <SettingsCard>
      <SettingsRow
        label="Bank account"
        value={
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Landmark aria-hidden className="size-4 text-lax-muted" strokeWidth={1.5} />
              <span>{payoutBankLineWithCurrency(account)}</span>
              <StatusBadge tone={status.tone} shape={status.shape}>
                {status.label}
              </StatusBadge>
            </span>
            {account.accountHolderName ? (
              <span className="text-lax-13 font-normal text-lax-muted">
                In the name of {account.accountHolderName}
              </span>
            ) : null}
            {changedLine ? (
              <span className="text-lax-13 font-normal text-lax-muted">{changedLine}</span>
            ) : null}
          </span>
        }
      />
      {account.status === "failed" ? (
        <p className="px-4 py-3 text-lax-13 text-lax-muted md:px-5">
          A payout to this account didn't go through. Add another account below and we'll send it
          again.
        </p>
      ) : null}
      {readOnlyNote ? (
        <p className="px-4 py-3 text-lax-13 text-lax-muted md:px-5">{readOnlyNote}</p>
      ) : null}
    </SettingsCard>
  );
}
