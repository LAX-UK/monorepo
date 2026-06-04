import { SaleCardActions } from "@/components/sections/sales/card/sale-card-actions";
import { SaleCardHeader } from "@/components/sections/sales/card/sale-card-header";
import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { SaleCardMeta } from "@/components/sections/sales/card/sale-card-meta";
import { SaleCardShell } from "@/components/sections/sales/card/sale-card-shell";
import { SaleCardTitle } from "@/components/sections/sales/card/sale-card-title";
import type { SaleAction } from "@/components/sections/sales/card/types";
import type { SaleAuctionRowVM } from "@/components/sections/sales/sales-view-models";
import { RevealInView } from "@/components/ui/reveal";

type Props = {
  vm: SaleAuctionRowVM;
  index?: number;
};

export function SalesAuctionRow({ vm, index = 0 }: Props) {
  const isLive = vm.status === "active" && Boolean(vm.countdownEndIso);

  const actions: SaleAction[] = [];
  if (vm.showRegisterButton) {
    actions.push({
      id: "register",
      label: "Register to bid",
      href: "/register",
      variant: "outline",
    });
  }
  actions.push({
    id: "lots",
    label: "View lots",
    href: vm.lotsHref,
    variant: "cta",
  });

  return (
    <li>
      <RevealInView variant="fadeUp" delayMs={index * 60} className="block w-full">
        <SaleCardShell className="p-3 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:gap-5 md:flex-row md:items-stretch md:gap-5 lg:gap-6">
            <SaleCardMedia
              href={vm.href}
              coverImageUrl={vm.coverImageUrl}
              coverImageAlt={vm.coverImageAlt}
              isLive={isLive}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 300px, 340px"
              className="max-h-[11rem] sm:max-h-none"
              {...(vm.countdownEndIso != null ? { countdownEndIso: vm.countdownEndIso } : {})}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-5 md:gap-6 lg:gap-8">
              <div className="flex flex-col gap-4">
                <SaleCardHeader
                  scheduleLead={vm.scheduleLead}
                  scheduleRest={vm.scheduleRest}
                  auctionTypeLine={vm.auctionTypeLine}
                  deliveryMode={vm.deliveryMode}
                  isLive={isLive}
                />
                <SaleCardTitle href={vm.href} title={vm.title} />
                <SaleCardMeta itemsLabel={vm.itemsLabel} />
              </div>
              <SaleCardActions actions={actions} />
            </div>
          </div>
        </SaleCardShell>
      </RevealInView>
    </li>
  );
}
