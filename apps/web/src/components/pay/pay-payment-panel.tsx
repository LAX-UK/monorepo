import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayMethodsVm } from "@/lib/pay/pay-methods";
import type { PayAction, PayMoneyVm, PayPageVm } from "@/lib/pay/pay-page.vm";
import { Button, Meter, TextLink } from "@auction/ui/lax";
import Link from "next/link";
import { PayActionButton, PayActionNote } from "./pay-action-button";
import { PayMethodChoice } from "./pay-method-choice";

/**
 * The money as the invoice states it, who it is from, how it is paid and the one action. Every
 * figure was sent by the server; the page only sets them out. While a check is open the rail
 * shows what Pay will be, disabled with the reason; the step that clears it is in the notice.
 */
export function PayPaymentPanel({
  money,
  methods,
  action,
  railPay,
}: {
  money: PayMoneyVm;
  methods: PayMethodsVm | null;
  action: PayAction | null;
  railPay: PayPageVm["railPay"];
}) {
  const pays = action?.kind === "pay";
  return (
    <WorkspacePanel title={PAY_COPY.panelPayment}>
      <dl className="flex flex-col gap-2 text-lax-14">
        {money.lines.map((line, index) => (
          <div key={`${index}-${line.label}`} className="flex justify-between gap-4">
            <dt className="text-lax-muted">{line.label}</dt>
            <dd className="text-right tabular-nums text-lax-fg">{line.amount}</dd>
          </div>
        ))}
        <div
          className={
            money.lines.length > 0
              ? "mt-2 flex justify-between gap-4 border-t border-lax-line pt-3 font-semibold"
              : "flex justify-between gap-4 font-semibold"
          }
        >
          <dt className="text-lax-fg">{money.totalLabel}</dt>
          <dd className="tabular-nums text-lax-fg">{money.total}</dd>
        </div>
      </dl>
      {money.meter ? (
        <div className="mt-4">
          <Meter value={money.meter.percent} label={money.meter.label} />
          <p className="mt-2 text-lax-13 text-lax-muted">{money.meter.caption}</p>
        </div>
      ) : null}
      {money.due ? <p className="mt-3 text-lax-13 text-lax-muted">{money.due}</p> : null}
      <p className="mt-3 text-lax-13 text-lax-muted">
        {money.company}
        {money.registration.length > 0 ? `. ${money.registration.join(", ")}` : ""}
      </p>
      {methods ? <PayMethodChoice methods={methods} /> : null}
      {railPay ? (
        <div className="mt-5 max-lg:hidden">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabledReason={railPay.reason}
            aria-describedby="pay-rail-reason"
          >
            {railPay.label}
          </Button>
          <p id="pay-rail-reason" className="mt-3 text-lax-13 text-lax-muted">
            {railPay.reason}
          </p>
        </div>
      ) : null}
      {action && pays ? (
        <div className="mt-5 flex flex-col gap-3">
          {/* On a phone the same action sits in the bar at the bottom. */}
          <PayActionButton action={action} className="w-full max-lg:hidden" />
          <PayActionNote action={action} />
          <p className="text-lax-13 text-lax-muted">
            {PAY_COPY.conditionsLine}
            <TextLink href="/terms" Link={Link}>
              {PAY_COPY.conditionsLink}
            </TextLink>
            {PAY_COPY.conditionsTail}
          </p>
        </div>
      ) : null}
    </WorkspacePanel>
  );
}
