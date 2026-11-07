import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { ListEmpty } from "@/components/workspace/list-states";
import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayPageVm } from "@/lib/pay/pay-page.vm";
import { ButtonLink, StatusBadge, TextLink, pageTitleClass } from "@auction/ui/lax";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PayFeedbackNotice } from "./pay-feedback";
import { PayLotsPanel } from "./pay-lots-panel";
import { PayNotices } from "./pay-notices";
import { PayPaymentPanel } from "./pay-payment-panel";
import { PayPhoneBar } from "./pay-phone-bar";
import { PayProgressWatch } from "./pay-progress-watch";
import { PaySessionProvider } from "./pay-session";
import { PayTransferPanel } from "./pay-transfer-panel";

/**
 * The Pay page: the same title row, panels and badge as the purchase page, a main column for the
 * lots and a rail for the money and the one action. It draws the view model and nothing else; a
 * held payment shows the money and the step that clears the check, never a way to pay.
 */
export function PayPage({ vm }: { vm: PayPageVm }) {
  const bar = vm.action && vm.money ? { action: vm.action, money: vm.money } : null;
  return (
    <PaySessionProvider
      methods={vm.methods}
      storageKey={vm.lots.map((lot) => lot.lotId).join(",")}
      returned={vm.returned}
    >
      {/* Room for the bar at the bottom of a phone. */}
      <div className={bar ? "flex flex-col gap-6 max-lg:pb-24" : "flex flex-col gap-6"}>
        <div className="flex flex-col gap-3">
          {vm.back ? (
            <TextLink
              href={vm.back.href}
              Link={Link}
              className="w-fit items-center gap-1 text-lax-13 no-underline hover:underline"
            >
              <ChevronLeft aria-hidden className="size-4" />
              {vm.back.label}
            </TextLink>
          ) : null}
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className={pageTitleClass} data-page-title="">
                {vm.title}
              </h1>
              {vm.subtitle ? (
                <p className="mt-1 text-lax-14 text-lax-muted">{vm.subtitle}</p>
              ) : null}
            </div>
            {vm.badge ? (
              <div className="flex shrink-0 items-center">
                <StatusBadge tone={vm.badge.tone} shape={vm.badge.shape}>
                  {vm.badge.label}
                </StatusBadge>
              </div>
            ) : null}
          </div>
        </div>
        <PayNotices notices={vm.notices} barAction={vm.action} />
        {vm.progress ? <PayProgressWatch progress={vm.progress} /> : null}
        <PayFeedbackNotice />
        {vm.empty ? (
          <ListEmpty
            illustration={vm.empty.illustration}
            title={vm.empty.title}
            description={vm.empty.description}
            actions={
              <ButtonLink href={vm.empty.action.href} Link={Link} variant="primary">
                {vm.empty.action.label}
              </ButtonLink>
            }
          />
        ) : null}
        {vm.progress && vm.lots.length > 0 && vm.money ? (
          // A payment under way: the bank details first when there are any, then the money, then the lots.
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            {vm.progress.details || vm.progress.detailsUnavailable ? (
              <div className="min-w-0 lg:col-start-1">
                <PayTransferPanel progress={vm.progress} />
              </div>
            ) : null}
            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <PayPaymentPanel money={vm.money} methods={null} action={null} railPay={null} />
            </div>
            <div className="min-w-0 lg:col-start-1">
              <PayLotsPanel lots={vm.lots} />
            </div>
          </div>
        ) : null}
        {!vm.progress && vm.lots.length > 0 && vm.money ? (
          // On a phone the order is lots, payment, delivery; from lg the payment is the rail.
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0 lg:col-start-1">
              <PayLotsPanel lots={vm.lots} />
            </div>
            <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <PayPaymentPanel
                money={vm.money}
                methods={vm.methods}
                action={vm.action}
                railPay={vm.railPay}
              />
            </div>
            <div className="min-w-0 lg:col-start-1">
              <WorkspacePanel title={PAY_COPY.panelDelivery}>
                <p className="text-lax-14 font-medium text-lax-fg">{PAY_COPY.deliveryTitle}</p>
                <p className="mt-1 text-lax-13 text-lax-muted">{PAY_COPY.deliveryNote}</p>
              </WorkspacePanel>
            </div>
          </div>
        ) : null}
      </div>
      {bar ? <PayPhoneBar money={bar.money} action={bar.action} /> : null}
    </PaySessionProvider>
  );
}
