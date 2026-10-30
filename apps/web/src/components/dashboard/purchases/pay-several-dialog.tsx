"use client";

import { formatMoney } from "@/lib/format-currency";
import {
  PAY_SEVERAL_BLOCK_COPY,
  PAY_SEVERAL_SKIP_COPY,
  type PaySeveralPlanView,
} from "@/lib/purchases/pay-several";
import { planPaySeveralAction, startPaySeveralAction } from "@/lib/purchases/purchase.actions";
import type { PurchaseCardVm } from "@/lib/purchases/purchases.vm";
import { Button, Dialog, DialogClose, Notice, Skeleton } from "@auction/ui/lax";
import { useEffect, useState, useTransition } from "react";

type PlanState =
  | { kind: "loading" }
  | { kind: "ready"; plan: PaySeveralPlanView }
  | { kind: "failed"; message: string };

function invoicesWord(count: number): string {
  return count === 1 ? "1 invoice" : `${count} invoices`;
}

/**
 * Pay several invoices with one payment. The plan comes from the server, which decides which
 * picks one payment can settle; invoices it leaves out are listed with the reason, so a stale
 * screen never pays the wrong thing. Paying opens the checkout, where card or bank transfer is
 * chosen and the payment confirmed: nothing is charged from this dialog.
 */
export function PaySeveralDialog({
  open,
  onOpenChange,
  lotIds,
  cardsById,
  organisation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotIds: readonly string[];
  cardsById: ReadonlyMap<string, PurchaseCardVm>;
  /** The paying account's name, or `null` for a person's own. */
  organisation: string | null;
}) {
  const [state, setState] = useState<PlanState>({ kind: "loading" });
  const [paying, startPaying] = useTransition();
  const [payError, setPayError] = useState<string | null>(null);
  const key = lotIds.join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the picked lot ids
  useEffect(() => {
    if (!open) return;
    let stale = false;
    setState({ kind: "loading" });
    setPayError(null);
    void planPaySeveralAction([...lotIds]).then((result) => {
      if (stale) return;
      setState(
        result.ok
          ? { kind: "ready", plan: result.plan }
          : { kind: "failed", message: result.message },
      );
    });
    return () => {
      stale = true;
    };
  }, [open, key]);

  const plan = state.kind === "ready" ? state.plan : null;
  const total = plan ? formatMoney(plan.total, plan.currency) : null;
  const blocked = !plan || plan.block !== null || plan.payable.length === 0;
  const pay = () =>
    startPaying(async () => {
      if (!plan) return;
      const result = await startPaySeveralAction(plan.payable.map((item) => item.lotId));
      if (result.ok) window.location.assign(result.url);
      else setPayError(result.message);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={plan ? `Pay ${invoicesWord(plan.payable.length)}` : "Pay invoices"}
      description={
        organisation
          ? `One payment for ${organisation}, by card or bank transfer. You confirm it at checkout.`
          : "One payment, by card or bank transfer. You confirm it at checkout."
      }
      footer={
        <>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            onClick={pay}
            loading={paying}
            {...(blocked && state.kind === "ready"
              ? { disabledReason: "Nothing here can be paid together as picked" }
              : {})}
            disabled={state.kind !== "ready"}
          >
            {total && !blocked ? `Pay ${total}` : "Pay"}
          </Button>
        </>
      }
    >
      {state.kind === "loading" ? (
        <output aria-label="Working out the total" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </output>
      ) : state.kind === "failed" ? (
        <Notice tone="danger" alert title={state.message} />
      ) : (
        <PlanBody plan={state.plan} cardsById={cardsById} />
      )}
      {payError ? <Notice tone="danger" alert title={payError} className="mt-4" /> : null}
    </Dialog>
  );
}

function PlanBody({
  plan,
  cardsById,
}: {
  plan: PaySeveralPlanView;
  cardsById: ReadonlyMap<string, PurchaseCardVm>;
}) {
  const title = (lotId: string) => cardsById.get(lotId)?.title ?? "A purchase";
  return (
    <div className="flex flex-col gap-5">
      {plan.block ? <Notice tone="warning" title={PAY_SEVERAL_BLOCK_COPY[plan.block]} /> : null}
      {plan.payable.length > 0 ? (
        <dl className="flex flex-col divide-y divide-lax-line rounded-lax-card border border-lax-line">
          {plan.payable.map((item) => (
            <div key={item.lotId} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="min-w-0 truncate text-lax-14 text-lax-fg">{title(item.lotId)}</dt>
              <dd className="shrink-0 text-lax-14 tabular-nums text-lax-fg">
                {formatMoney(item.totalDue, plan.currency)}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-lax-14 font-semibold text-lax-fg">Total</dt>
            <dd className="text-lax-14 font-semibold tabular-nums text-lax-fg">
              {formatMoney(plan.total, plan.currency)}
            </dd>
          </div>
        </dl>
      ) : null}
      {plan.skipped.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-lax-14 font-semibold text-lax-fg">Not in this payment</h3>
          <ul className="flex flex-col gap-2">
            {plan.skipped.map((item) => (
              <li key={item.lotId} className="text-lax-14 text-lax-fg">
                {title(item.lotId)}
                <span className="block text-lax-13 text-lax-muted">
                  {PAY_SEVERAL_SKIP_COPY[item.reason]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
