"use client";

import { buildListHref } from "@/lib/admin/admin-list-params";
import { Input } from "@auction/ui/components/input";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";

type Props = {
  paramName?: string;
  placeholder?: string;
  className?: string;
};

/** URL-driven list search — updates `q` (or custom) search param. */
export function AdminListSearch({ paramName = "q", placeholder = "Search…", className }: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const value = searchParams.get(paramName) ?? "";

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const q = String(fd.get(paramName) ?? "").trim();
        const next = new URLSearchParams(searchParams.toString());
        if (q) next.set(paramName, q);
        else next.delete(paramName);
        next.set("offset", "0");
        startTransition(() => {
          router.push(`${pathname}?${next.toString()}`);
        });
      }}
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <div className="relative min-w-[12rem] max-w-md">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <Input
          id={id}
          name={paramName}
          defaultValue={value}
          placeholder={placeholder}
          className="h-9 pl-9 font-body text-sm"
        />
      </div>
    </form>
  );
}

/** Server-friendly search form using GET (for RSC list pages). */
export function AdminListSearchGet({
  action,
  defaultValue = "",
  paramName = "q",
  placeholder = "Search…",
  hiddenFields,
}: {
  action: string;
  defaultValue?: string;
  paramName?: string;
  placeholder?: string;
  hiddenFields?: Record<string, string>;
}) {
  const id = useId();
  return (
    <form method="get" action={action} className="flex items-center gap-2">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))
        : null}
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <div className="relative min-w-[12rem] max-w-md">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <Input
          id={id}
          name={paramName}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="h-9 pl-9 font-body text-sm"
        />
      </div>
    </form>
  );
}

export { buildListHref };
