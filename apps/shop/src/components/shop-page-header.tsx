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
};

export function ShopPageHeader({ title, breadcrumbs }: ShopPageHeaderProps) {
  return (
    <header className="shop-page-header">
      <Breadcrumb className="shop-page-header__breadcrumb">
        <BreadcrumbList>
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const key = `${item.label}-${item.href ?? "current"}`;
            return (
              <Fragment key={key}>
                {index > 0 ? (
                  <BreadcrumbSeparator className="shop-page-header__separator">
                    /
                  </BreadcrumbSeparator>
                ) : null}
                <BreadcrumbItem>
                  {item.href && !isLast ? (
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
      <h1 className="shop-page-header__title">{title}</h1>
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
  confirmation: {
    title: "Order confirmation",
    breadcrumbs: [shopRoot, { label: "Checkout", href: "/checkout" }, { label: "Confirmation" }],
  },
  account: {
    title: "Your account",
    breadcrumbs: [shopRoot, { label: "Account" }],
  },
  accountDisabled: {
    title: "Account disabled",
    breadcrumbs: [shopRoot, { label: "Account", href: "/account" }, { label: "Disabled" }],
  },
  orders: {
    title: "Your orders",
    breadcrumbs: [shopRoot, { label: "Account", href: "/account" }, { label: "Orders" }],
  },
  orderDetail: (orderShortLabel: string) => ({
    title: `Order ${orderShortLabel}`,
    breadcrumbs: [
      shopRoot,
      { label: "Account", href: "/account" },
      { label: "Orders", href: "/account/orders" },
      { label: orderShortLabel },
    ],
  }),
  accountSignIn: {
    title: "Sign in required",
    breadcrumbs: [shopRoot, { label: "Account" }],
  },
  accountUnavailable: {
    title: "Account unavailable",
    breadcrumbs: [shopRoot, { label: "Account" }],
  },
} as const;
