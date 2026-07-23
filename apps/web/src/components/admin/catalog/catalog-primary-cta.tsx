import { Button } from "@auction/ui/components/button";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  icon?: LucideIcon;
};

/** Canonical primary CTA for catalog list headers (New lot / sale / artist / category). */
export function CatalogPrimaryCta({ href, children, icon: Icon }: Props) {
  return (
    <Button
      variant="default"
      asChild
      className="min-h-10 rounded-lg bg-secondary px-4 font-label text-sm font-medium hover:bg-secondary/90"
    >
      <Link href={href}>
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
        {children}
      </Link>
    </Button>
  );
}
