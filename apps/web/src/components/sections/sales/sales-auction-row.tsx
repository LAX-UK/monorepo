import { SaleCardActions } from "@/components/sections/sales/card/sale-card-actions";
import { SaleCardHeader } from "@/components/sections/sales/card/sale-card-header";
import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { SaleCardMeta } from "@/components/sections/sales/card/sale-card-meta";
import { SaleCardShell } from "@/components/sections/sales/card/sale-card-shell";
import { SaleCardTitle } from "@/components/sections/sales/card/sale-card-title";
import type { SaleAction } from "@/components/sections/sales/card/types";
import type { SaleAuctionRowVM } from "@/components/sections/sales/sales-view-models";

type Props = {
  vm: SaleAuctionRowVM;
  index?: number;
};

export function SalesAuctionRow({ vm, index = 0 }: Props) {
  const isLive = vm.status === "active" && Boolean(vm.countdownEndIso);
  const delay = index * 50;

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
    <li className="sales-calendar-row-animate" style={{ animationDelay: `${delay}ms` }}>
      <SaleCardShell>
        <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-stretch lg:gap-6">
          <SaleCardMedia
            href={vm.href}
            coverImageUrl={vm.coverImageUrl}
            coverImageAlt={vm.coverImageAlt}
            isLive={isLive}
            sizes="(max-width: 1024px) 100vw, 420px"
            {...(vm.countdownEndIso != null ? { countdownEndIso: vm.countdownEndIso } : {})}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-6 lg:gap-8">
            <div className="flex flex-col gap-4">
              <SaleCardHeader
                scheduleLead={vm.scheduleLead}
                scheduleRest={vm.scheduleRest}
                auctionTypeLine={vm.auctionTypeLine}
              />
              <SaleCardTitle href={vm.href} title={vm.title} />
              <SaleCardMeta itemsLabel={vm.itemsLabel} />
            </div>
            <SaleCardActions actions={actions} />
          </div>
        </div>
      </SaleCardShell>
    </li>
  );
}
