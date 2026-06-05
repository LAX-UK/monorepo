"use client";

import type { LotCardVM } from "@/components/sections/home/home-view-models";
import type { UrgencySectionVariant } from "@/components/sections/home/lax-urgency-section";
import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import { catalogViewCarryParams, lotCatalogHref } from "@/lib/marketing/catalog-links";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { UrgencyLotCard } from "./urgency-lot-card";
import { UrgencyLotRow } from "./urgency-lot-row";

function urgencySwitcherValue(v: CatalogLayoutView): CatalogLayoutView {
  return v === "list" ? "list" : "grid";
}

function urgencyLotHref(item: LotCardVM, layoutView: CatalogLayoutView): string {
  return lotCatalogHref(
    { id: item.id, title: item.title },
    catalogViewCarryParams(urgencySwitcherValue(layoutView)),
  );
}

type Props = {
  variant: UrgencySectionVariant;
  items: LotCardVM[];
  initialLayoutView: CatalogLayoutView;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
};

export function LaxUrgencySectionBody({
  variant,
  items,
  initialLayoutView,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
}: Props) {
  const layoutView = useUrlLayoutView("grid", initialLayoutView) as CatalogLayoutView;
  const switcherValue = urgencySwitcherValue(layoutView);
  const isList = switcherValue === "list";

  if (isList) {
    return (
      <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <UrgencyLotRow
              variant={variant}
              item={{ ...item, href: urgencyLotHref(item, layoutView) }}
              isAuthenticated={isAuthenticated}
              watchedLotIds={watchedLotIds}
              loginNextPath={loginNextPath}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-4 md:gap-6 lg:grid-cols-4 lg:gap-8">
      {items.map((item, index) => (
        <UrgencyLotCard
          key={item.id}
          item={{ ...item, href: urgencyLotHref(item, layoutView) }}
          index={index}
          isAuthenticated={isAuthenticated}
          watchedLotIds={watchedLotIds}
          loginNextPath={loginNextPath}
        />
      ))}
    </div>
  );
}
