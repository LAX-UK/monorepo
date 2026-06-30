"use client";

import { Input } from "@auction/ui/components/input";
import { Search } from "lucide-react";

type Props = {
  value: string;
  onSearch: (q: string) => void;
  placeholder?: string;
  className?: string;
  inputId?: string;
  pending?: boolean;
};

/** Presentational admin list search — caller wires nuqs or other URL state. */
export function AdminListNuqsSearch({
  value,
  onSearch,
  placeholder = "Search…",
  className,
  inputId = "admin-list-nuqs-search",
  pending = false,
}: Props) {
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        onSearch(q);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <div className="relative min-w-[12rem] max-w-md">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <Input
          key={value}
          id={inputId}
          name="q"
          defaultValue={value}
          placeholder={placeholder}
          className="h-9 pl-9 font-body text-sm"
          disabled={pending}
          aria-busy={pending}
        />
      </div>
    </form>
  );
}
