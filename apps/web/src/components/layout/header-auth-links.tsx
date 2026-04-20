"use client";

import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { linkTop } from "./header-nav-config";

type HeaderAuthLinksProps = {
  user: SessionUser | null;
  variant?: "utility" | "drawer";
  onNavigate?: () => void;
};

const drawerLinkClass =
  "block py-2 font-label text-sm font-medium uppercase tracking-wide text-brand-900";

export function HeaderAuthLinks({ user, variant = "utility", onNavigate }: HeaderAuthLinksProps) {
  const c = variant === "utility" ? linkTop : drawerLinkClass;

  const navProps = onNavigate !== undefined ? { onClick: onNavigate } : {};

  if (user) {
    return (
      <Link href="/dashboard" className={c} {...navProps}>
        Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link href="/login" className={c} {...navProps}>
        Log in
      </Link>
      <Link href="/register" className={c} {...navProps}>
        Register
      </Link>
    </>
  );
}
