import type { SellingRouteVm } from "@/lib/editorial/how-to-sell.vm";
import { MarketingArrowUpRightIcon } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";

/**
 * "How to sell": lax.art does not take consignments, so the page offers the two ways to sell in
 * LAX, side by side from `sm`, each a bordered panel with one action into the product that
 * handles it. The first route is the primary action.
 */
export function ArtSellingRoutes({ routes }: { routes: readonly SellingRouteVm[] }) {
  return (
    <section aria-labelledby="selling-routes-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2
          id="selling-routes-title"
          className="font-headline text-xl font-semibold text-on-surface"
        >
          Selling a work
        </h2>
        <p className="text-on-surface-variant">
          The gallery does not take works on consignment. Choose the route that fits you.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {routes.map((route, index) => (
          <li
            key={route.id}
            className="flex flex-col gap-4 rounded-lg border border-border-hairline p-6"
          >
            <div className="flex flex-1 flex-col gap-2">
              <h3 className="font-headline text-lg font-medium text-on-surface">{route.title}</h3>
              <p className="text-sm text-on-surface-variant">{route.description}</p>
            </div>
            <Button
              asChild
              variant={index === 0 ? "default" : "secondaryOutline"}
              className="min-h-11 w-full justify-center gap-2 sm:w-fit"
            >
              <a href={route.action.href}>
                {route.action.label}
                <span className="sr-only"> ({route.action.productName})</span>
                <MarketingArrowUpRightIcon className="size-4" />
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
