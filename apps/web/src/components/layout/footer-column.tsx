"use client";

import { linkIsCurrent } from "@/lib/nav/is-current";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type FooterLink = { href: string; label: string };

type FooterColumnProps = {
  title: string;
  links: FooterLink[];
  linkClassName: string;
  headingClassName: string;
};

export function FooterColumn({ title, links, linkClassName, headingClassName }: FooterColumnProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-4">
      <h2 className={headingClassName}>{title}</h2>
      <ul className="flex flex-col gap-4">
        {links.map((l) => {
          const current = linkIsCurrent(pathname, l.href);
          return (
            <li key={l.label}>
              <Link
                href={l.href}
                className={cn(
                  linkClassName,
                  current && "text-primary underline underline-offset-4",
                )}
                aria-current={current ? "page" : undefined}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
