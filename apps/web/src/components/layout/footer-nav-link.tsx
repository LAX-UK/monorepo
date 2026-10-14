"use client";

import { linkIsCurrent } from "@/lib/nav/is-current";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

type FooterNavLinkProps = {
  href: string;
  label: string;
  className: string;
};

export function FooterNavLink({ href, label, className }: FooterNavLinkProps) {
  const current = linkIsCurrent(usePathname(), href);
  return (
    <Link
      href={href}
      className={cn(className, current && "text-link underline underline-offset-4")}
      aria-current={current ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
