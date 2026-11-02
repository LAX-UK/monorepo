"use client";

import { cn } from "@auction/ui";
import { Button, TextInput } from "@auction/ui/lax";
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
      className={cn("min-w-0", className)}
    >
      <TextInput
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search this sale…"
        aria-label="Search lots in this sale"
        leading={<Search aria-hidden />}
        trailing={
          current ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setValue("");
                commit("");
              }}
              aria-label="Clear search"
              className="-mr-2"
            >
              <X aria-hidden />
            </Button>
          ) : null
        }
      />
    </form>
  );
}
