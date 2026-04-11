import { MaterialIcon } from "@/components/ui/material-icon";
import Link from "next/link";

const nav = [
  { href: "/", label: "Upcoming Auctions" },
  { href: "/#archive", label: "Past Auctions" },
  { href: "/artist/featured", label: "Artists" },
];

export function SiteHeader() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant/10 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1920px] items-center justify-between px-6 py-5 md:px-20">
        <Link
          href="/"
          className="font-headline text-xl font-bold tracking-tighter text-stone-900 md:text-2xl"
        >
          The Digital Curator
        </Link>
        <nav className="hidden items-center gap-12 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500 transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-6 md:gap-8">
          <span className="text-stone-600" aria-hidden>
            <MaterialIcon name="search" className="cursor-pointer hover:text-primary" />
          </span>
          <Link href="/dashboard" className="text-stone-600" aria-label="Account">
            <MaterialIcon name="person" className="cursor-pointer hover:text-primary" />
          </Link>
          <span className="lg:hidden" aria-hidden>
            <MaterialIcon name="menu" />
          </span>
        </div>
      </div>
    </header>
  );
}
