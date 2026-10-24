import { AccountSection, EMPTY_STATE, LIST_ROW, ListCard } from "@/components/account-ui";
import { PORTFOLIO_ROUTES } from "@/server/domain/portfolio-routes";
import type { PayoutsListVm } from "@/server/domain/selling/selling-payouts.vm";
import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import { MONEY, SellingStatus, formatPence } from "./selling-parts";

/** Each payout LAX has made or owes, newest first, with what was taken off. */
export function SellingPayoutsList({ list }: { list: PayoutsListVm }) {
  return (
    <AccountSection
      id="payouts"
      title="Payout history"
      description={
        list.rows.length > 0
          ? `${formatPence(list.totals.paidPence)} paid to you · ${formatPence(list.totals.toComePence)} to come`
          : undefined
      }
    >
      {list.rows.length === 0 ? (
        <EmptyState
          className={EMPTY_STATE}
          headingLevel="h3"
          title="No payouts yet"
          description="After an edition sells and its refund period ends, LAX pays you and the payout appears here."
        />
      ) : (
        <ListCard>
          {list.rows.map((row) => (
            <li key={row.payoutId} id={`payout-${row.payoutId}`} className="scroll-mt-4">
              <div className={cn(LIST_ROW, "py-3")}>
                <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
                  <SellingStatus
                    label={row.status.label}
                    tone={row.status.tone}
                    className="self-start"
                  />
                  <span className="text-xs text-on-surface-variant">
                    Sale price {formatPence(row.grossPence)} · LAX fees {formatPence(row.feesPence)}
                  </span>
                </div>
                <span
                  className={cn(MONEY, "font-headline text-base font-semibold text-on-surface")}
                >
                  {formatPence(row.netPence)}
                </span>
              </div>
            </li>
          ))}
        </ListCard>
      )}
      <p className="text-sm text-on-surface-variant">
        Payouts also appear with your other LAX payments in{" "}
        <a
          href={PORTFOLIO_ROUTES.money}
          className="underline underline-offset-4 hover:text-on-surface"
        >
          Money
        </a>
        .
      </p>
    </AccountSection>
  );
}
