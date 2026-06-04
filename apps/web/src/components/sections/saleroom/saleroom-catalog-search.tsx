"use client";

import { cn } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

type Props = {
  className?: string;
};

/** In-sale keyword search for the saleroom catalogue (filters lots by title). */
export function SaleroomCatalogSearch({ className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("q") ?? "";
  const [value, setValue] = useState(current);

  useEffect(() => {
    setValue(current);
  }, [current]);

  function commit(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    commit(value);
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Search lots in this sale"
      className={cn("relative flex min-w-0 items-center", className)}
    >
      <Search
        className="pointer-events-none absolute left-3 size-4 text-on-surface-variant"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search this sale…"
        aria-label="Search lots in this sale"
        className="h-10 min-h-10 w-full rounded-full border-outline-variant/40 bg-surface-container-lowest pl-9 pr-9 font-body text-sm shadow-none focus-visible:ring-primary"
      />
      {current ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            commit("");
          }}
          aria-label="Clear search"
          className="absolute right-2 inline-flex size-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </form>
  );
}
