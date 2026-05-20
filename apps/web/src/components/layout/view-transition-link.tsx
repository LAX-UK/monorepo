"use client";

import { useViewTransitionRouter } from "@/lib/hooks/use-view-transition-router";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, MouseEventHandler } from "react";

type Props = ComponentProps<typeof Link>;

/** Next.js Link that navigates through the view-transition router on admin routes. */
export function ViewTransitionLink({ href, onClick, ...rest }: Props) {
  const router = useViewTransitionRouter();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    onClick?.(e);
    if (!isAdmin) return;
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target === "_blank") return;
    e.preventDefault();
    router.push(typeof href === "string" ? href : String(href));
  };

  if (!isAdmin) {
    return <Link href={href} {...rest} {...(onClick ? { onClick } : {})} />;
  }

  return <Link href={href} {...rest} onClick={handleClick} />;
}
