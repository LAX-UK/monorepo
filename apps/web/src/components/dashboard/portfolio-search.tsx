"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@auction/ui/components/input";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export function PortfolioSearchBar({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);

  const apply = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    const trimmed = q.trim();
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, q, router, searchParams]);

  return (
    <form
      className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div className="flex-1 space-y-2">
        <label
          htmlFor="portfolio-q"
          className="font-label text-xs uppercase tracking-widest text-secondary"
        >
          Search collection
        </label>
        <Input
          id="portfolio-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by title…"
          className="max-w-md bg-surface-container-low"
        />
      </div>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
