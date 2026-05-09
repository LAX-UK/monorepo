"use client";

import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { HeaderUserMenu } from "./header-user-menu";

const loginPillClass =
  "inline-flex items-center justify-center rounded-full border border-brand-900 px-4 py-1.5 font-label text-sm font-medium uppercase leading-[21px] text-brand-900 transition-colors hover:bg-brand-900 hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold motion-reduce:transition-none dark:border-on-surface dark:text-on-surface dark:hover:bg-on-surface dark:hover:text-brand-900";

const registerPillClass =
  "inline-flex items-center justify-center rounded-full bg-cta-bg px-4 py-1.5 font-label text-sm font-semibold uppercase leading-[21px] text-cta-on transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold motion-reduce:transition-none";

type HeaderAuthLinksProps = {
  user: SessionUser | null;
};

export function HeaderAuthLinks({ user }: HeaderAuthLinksProps) {
  if (user) {
    return <HeaderUserMenu user={user} />;
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/login" className={loginPillClass}>
        Log in
      </Link>
      <Link href="/register" className={registerPillClass}>
        Register
      </Link>
    </div>
  );
}
