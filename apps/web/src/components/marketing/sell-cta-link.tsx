"use client";

import { trackSellCtaClick } from "@/lib/analytics/sell-funnel";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Props = Omit<ComponentProps<typeof Link>, "onClick"> & {
  source: Parameters<typeof trackSellCtaClick>[0];
  children: ReactNode;
};

/** Client-only sell CTA link with analytics — safe to compose from Server Components. */
export function SellCtaLink({ source, children, ...linkProps }: Props) {
  return (
    <Link {...linkProps} onClick={() => trackSellCtaClick(source)}>
      {children}
    </Link>
  );
}
