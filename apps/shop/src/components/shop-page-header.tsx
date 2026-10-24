import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@auction/ui/components/breadcrumb";
import Link from "next/link";
import { Fragment } from "react";

export type ShopBreadcrumbItem = {
  label: string;
  href?: string;
};

export type ShopPageHeaderProps = {
  title: string;
  breadcrumbs: readonly ShopBreadcrumbItem[];
  /** PDP and similar layouts render the primary h1 in page content. */
  suppressTitle?: boolean;
};

export function ShopPageHeader({ title, breadcrumbs, suppressTitle }: ShopPageHeaderProps) {
  return (
    <header className="shop-page-header">
      <Breadcrumb className="shop-page-header__breadcrumb">
        <BreadcrumbList>
          {breadcrumbs.map((item, index) => {
            const key = `${item.label}-${item.href ?? "current"}`;
            return (
              <Fragment key={key}>
                {index > 0 ? (
                  <BreadcrumbSeparator className="shop-page-header__separator">
                    /
                  </BreadcrumbSeparator>
                ) : null}
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink asChild className="shop-page-header__link shop-focus-ring">
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="shop-page-header__current">
                      {item.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      {suppressTitle ? null : <h1 className="shop-page-header__title">{title}</h1>}
    </header>
  );
}

const shopRoot: ShopBreadcrumbItem = { label: "Shop", href: "/" };

export const shopPageWayfinding = {
  basket: {
    title: "Basket",
    breadcrumbs: [shopRoot, { label: "Basket" }],
  },
  checkout: {
    title: "Checkout",
    breadcrumbs: [shopRoot, { label: "Checkout" }],
  },
  checkoutCancel: {
    title: "Checkout cancelled",
    breadcrumbs: [shopRoot, { label: "Checkout", href: "/checkout" }, { label: "Cancelled" }],
  },
  confirmation: {
    title: "Order confirmation",
    breadcrumbs: [shopRoot, { label: "Checkout", href: "/checkout" }, { label: "Confirmation" }],
  },
  accountDisabled: {
    title: "Account disabled",
    breadcrumbs: [shopRoot, { label: "Account disabled" }],
  },
  orders: {
    title: "Your orders",
    breadcrumbs: [shopRoot, { label: "Your orders" }],
  },
  orderDetail: (title: string) => ({
    title,
    /** Ends at "Your orders": the h1 names the order, so a third crumb would repeat it. */
    breadcrumbs: [shopRoot, { label: "Your orders", href: "/account/orders" }],
  }),
  accountSaleLimits: {
    title: "Sale limits",
    breadcrumbs: [shopRoot, { label: "Sale limits" }],
  },
  accountSales: {
    title: "Sales statement",
    breadcrumbs: [shopRoot, { label: "Sales" }],
  },
  accountPayouts: {
    title: "Payouts",
    breadcrumbs: [shopRoot, { label: "Payouts" }],
  },
  accountArtworks: {
    title: "My artworks",
    breadcrumbs: [shopRoot, { label: "My artworks" }],
  },
  accountArtistSales: {
    title: "Artist sales",
    breadcrumbs: [shopRoot, { label: "Artist sales" }],
  },
} as const;
