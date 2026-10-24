"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../lib/cn.js";
import {
  StaffMenu,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuLabel,
  StaffMenuTrigger,
} from "../primitives/menu.js";
import type { StaffProduct } from "./types.js";

/** The product's monogram tile: the accent fills it, so identity reads at a glance. */
export function ProductMark({ product, className }: { product: StaffProduct; className?: string }) {
  return (
    <span
      aria-hidden
      data-staff-product={product.id === "bid-admin" ? "bid" : "lax-admin"}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-staff-xs bg-staff-accent font-staff-display text-staff-2xs font-bold text-staff-on-ink",
        className,
      )}
    >
      {product.id === "bid-admin" ? "B" : "L"}
    </span>
  );
}

/**
 * Which staff tool you are in, and the way to the other. Each tool keeps its own pages and
 * permissions; the switcher lists only the tools this person can open, and is a plain heading
 * when there is just one.
 */
export function ProductSwitcher({
  current,
  products,
  collapsed = false,
}: {
  current: StaffProduct;
  products: readonly StaffProduct[];
  collapsed?: boolean;
}) {
  const label = (
    <>
      <ProductMark product={current} />
      {collapsed ? null : (
        <span className="min-w-0 flex-1 truncate text-left font-staff-display text-staff-sm font-semibold text-staff-fg">
          {current.name}
        </span>
      )}
    </>
  );
  if (products.length <= 1) {
    return (
      <div
        className={cn(
          "flex h-control-sm items-center gap-2.5 px-2",
          collapsed && "justify-center px-0",
        )}
      >
        {label}
      </div>
    );
  }
  return (
    <StaffMenu>
      <StaffMenuTrigger
        aria-label={`${current.name}. Switch staff tool`}
        className={cn(
          "staff-focus flex h-control-sm w-full items-center gap-2.5 rounded-staff-sm px-2 transition-colors",
          "hover:bg-staff-hover data-[state=open]:bg-staff-pressed",
          collapsed && "justify-center px-0",
        )}
      >
        {label}
        {collapsed ? null : <ChevronsUpDown aria-hidden className="size-4 text-staff-subtle" />}
      </StaffMenuTrigger>
      <StaffMenuContent align="start" className="w-72">
        <StaffMenuLabel>Staff tools</StaffMenuLabel>
        {products.map((product) => {
          const active = product.id === current.id;
          return (
            <StaffMenuItem key={product.id} asChild className="items-start py-2">
              <a href={product.href} {...(active ? { "aria-current": "page" as const } : {})}>
                <ProductMark product={product} className="mt-0.5" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-staff-fg">{product.name}</span>
                  <span className="text-staff-xs text-staff-muted">{product.description}</span>
                </span>
                {active ? <Check aria-hidden className="mt-0.5 text-staff-fg" /> : null}
              </a>
            </StaffMenuItem>
          );
        })}
      </StaffMenuContent>
    </StaffMenu>
  );
}
