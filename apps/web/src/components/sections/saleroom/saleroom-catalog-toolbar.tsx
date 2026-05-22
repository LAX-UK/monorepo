"use client";

import { cn } from "@auction/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ChipState = "all" | "live" | "upcoming" | "ended";

type ChipDef = { label: string; value: ChipState; href: string };

type Props = {
  /** Path of the current saleroom (e.g. `/sales/abc`). */
  basePath: string;
};

function buildHref(basePath: string, value: ChipState, current: URLSearchParams): string {
  const next = new URLSearchParams(current);
  if (value === "all") {
    next.delete("status");
  } else {
    next.set("status", value);
  }
  next.delete("page");
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function activeChip(params: URLSearchParams): ChipState {
  const raw = params.get("status");
  if (raw === "live" || raw === "upcoming" || raw === "ended") return raw;
  return "all";
}

export function SaleroomCatalogToolbar({ basePath }: Props) {
  const params = useSearchParams();
  const active = activeChip(new URLSearchParams(params?.toString() ?? ""));
  const chips: ChipDef[] = [
    {
      label: "All",
      value: "all",
      href: buildHref(basePath, "all", new URLSearchParams(params?.toString() ?? "")),
    },
    {
      label: "Live",
      value: "live",
      href: buildHref(basePath, "live", new URLSearchParams(params?.toString() ?? "")),
    },
    {
      label: "Upcoming",
      value: "upcoming",
      href: buildHref(basePath, "upcoming", new URLSearchParams(params?.toString() ?? "")),
    },
    {
      label: "Ended",
      value: "ended",
      href: buildHref(basePath, "ended", new URLSearchParams(params?.toString() ?? "")),
    },
  ];

  return (
    <nav aria-label="Catalog filters" className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const isActive = active === c.value;
        return (
          <Link
            key={c.value}
            href={c.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center rounded-full border px-3.5 py-1.5 font-label text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
              isActive
                ? "border-brand-900 bg-brand-900 text-white dark:border-on-surface dark:bg-on-surface dark:text-surface"
                : "border-divider-soft text-on-surface-variant hover:border-brand-900/60 hover:text-brand-900 dark:hover:text-on-surface",
            )}
          >
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
