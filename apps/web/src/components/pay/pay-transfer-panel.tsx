import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayProgressVm } from "@/lib/pay/pay-page.vm";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { FactList } from "@auction/ui/lax/fact-list";
import { PayCopyButton } from "./pay-copy-button";

/**
 * Where to send a bank transfer: the account details and the reference, as the payment provider
 * issued them for this payment, each with a copy button. If they could not be read, it says where
 * else to find them and never guesses.
 */
export function PayTransferPanel({
  progress,
}: {
  progress: Pick<PayProgressVm, "details" | "detailsUnavailable" | "contactHref">;
}) {
  return (
    <WorkspacePanel title={PAY_COPY.transferPanelTitle}>
      {progress.details ? (
        <>
          <FactList
            facts={progress.details.rows.map((row) => ({
              label: row.label,
              value: (
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 font-medium tabular-nums">{row.value}</span>
                  {row.copy ? <PayCopyButton value={row.copy} what={row.label} /> : null}
                </span>
              ),
            }))}
          />
          <p className="mt-4 text-lax-13 text-lax-muted">{PAY_COPY.transferNote}</p>
        </>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-lax-14 text-lax-fg">{PAY_COPY.transferUnavailable}</p>
          {progress.detailsUnavailable ? (
            <ButtonLink href={progress.contactHref} variant="secondary">
              {PAY_COPY.contactSettlements}
            </ButtonLink>
          ) : null}
        </div>
      )}
    </WorkspacePanel>
  );
}
