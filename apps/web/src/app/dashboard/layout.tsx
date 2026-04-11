import { MaterialIcon } from "@/components/ui/material-icon";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/bids", label: "Active Bids", icon: "gavel" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "palette" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) {
    redirect("/?auth=required");
  }

  return (
    <div className="flex min-h-screen bg-surface font-body text-on-surface">
      <aside className="fixed z-50 flex h-full w-64 flex-col border-r border-outline-variant/20 bg-white">
        <div className="p-8">
          <Link
            href="/"
            className="mb-12 block font-headline text-xl tracking-tighter text-stone-900"
          >
            The Digital Curator
          </Link>
          <p className="mb-6 font-label text-[10px] uppercase tracking-widest text-secondary">
            Signed in
          </p>
          <p className="font-mono text-xs text-on-surface-variant">{user.id.slice(0, 12)}…</p>
          <nav className="mt-12 space-y-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center px-4 py-3 text-xs font-medium uppercase tracking-widest text-on-surface transition-all hover:bg-surface-container-low"
              >
                <MaterialIcon name={l.icon} className="mr-3 text-lg" />
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-8">
          <Link
            href="/"
            className="font-label text-[10px] uppercase tracking-widest text-primary hover:underline"
          >
            Exit to gallery
          </Link>
        </div>
      </aside>
      <div className="min-h-screen flex-1 pl-64">
        <div className="px-8 py-12 md:px-20">{children}</div>
      </div>
    </div>
  );
}
