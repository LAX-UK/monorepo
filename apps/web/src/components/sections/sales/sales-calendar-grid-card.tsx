import { SaleCardActions } from "@/components/sections/sales/card/sale-card-actions";
import { SaleCardMedia } from "@/components/sections/sales/card/sale-card-media";
import { SaleCardShell } from "@/components/sections/sales/card/sale-card-shell";
import { SaleCardTitle } from "@/components/sections/sales/card/sale-card-title";
import type { SaleAction } from "@/components/sections/sales/card/types";
import type { CalendarGridCardVM } from "@/components/sections/sales/sales-view-models";
import { RevealInView } from "@/components/ui/reveal";
import { cn } from "@auction/ui";

type Props = {
  vm: CalendarGridCardVM;
  index?: number;
};

export function SalesCalendarGridCard({ vm, index = 0 }: Props) {
  const isLive = vm.status === "active" && Boolean(vm.countdownEndIso);

  const actions: SaleAction[] = [];
  if (vm.showRegisterButton) {
    actions.push({
      id: "register",
      label: "Register",
      href: "/register",
      variant: "outline",
      ariaLabel: "Register to bid",
    });
  }
  actions.push({
    id: "lots",
    label: "View lots",
    href: vm.lotsHref,
    variant: "cta",
  });

  const metaLine = [vm.locationLabel?.trim(), vm.itemsLabel].filter(Boolean).join(" · ");

  return (
    <li className="h-full min-w-0">
      <RevealInView variant="fadeUp" delayMs={index * 70} className="block h-full min-w-0">
        <SaleCardShell className="flex h-full min-h-0 flex-col gap-2 p-3 md:gap-3 md:p-4 lg:gap-3">
          <SaleCardMedia
            href={vm.href}
            coverImageUrl={vm.coverImageUrl}
            coverImageAlt={vm.coverImageAlt}
            isLive={isLive}
            linkMode="area"
            layout="featured"
            imageRoundedClassName="rounded"
            scrimClassName="rounded bg-black/20"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 50vw, 33vw"
            {...(vm.countdownEndIso != null ? { countdownEndIso: vm.countdownEndIso } : {})}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-2">
            <div className="flex flex-col gap-0.5 md:flex-row md:flex-wrap md:items-center md:gap-2 md:gap-2.5">
              <span className="font-body text-[0.65rem] font-normal leading-snug text-on-surface sm:text-xs md:text-sm">
                {vm.auctionTypeLabel}
              </span>
              <span className="font-body text-[0.6rem] font-normal uppercase leading-snug text-on-surface-variant md:border-l md:border-on-surface-variant md:pl-2 md:text-xs">
                {vm.dateLabel}
              </span>
            </div>

            <SaleCardTitle
              href={vm.href}
              title={vm.title}
              className={cn("line-clamp-2 text-xs sm:text-sm md:text-base md:leading-snug")}
            />

            {metaLine ? (
              <p className="line-clamp-2 font-body text-[10px] leading-snug text-on-surface-variant md:text-xs">
                {metaLine}
              </p>
            ) : null}
          </div>

          <div className="mt-auto hidden w-full md:block">
            <SaleCardActions
              actions={actions}
              className="mt-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-stretch sm:gap-2"
            />
          </div>
        </SaleCardShell>
      </RevealInView>
    </li>
  );
}
