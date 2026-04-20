"use client";

import { MaterialIcon } from "@/components/ui/material-icon";

type HeaderSearchProps = {
  variant: "desktop" | "mobile";
  /** Used for desktop label association; mobile uses `${inputId}-field`. */
  inputId?: string;
  className?: string;
};

export function HeaderSearch({
  variant,
  inputId = "site-header-search",
  className = "",
}: HeaderSearchProps) {
  if (variant === "desktop") {
    return (
      <form
        action="/search"
        method="get"
        className={`hidden min-w-0 flex-1 items-center border-b border-brand-200 md:flex lg:w-[231px] lg:flex-none ${className}`}
      >
        <label htmlFor={inputId} className="sr-only">
          Search
        </label>
        <input
          id={inputId}
          name="q"
          type="search"
          placeholder="Search"
          className="min-w-0 flex-1 bg-transparent py-2 font-label text-sm font-medium leading-[21px] text-brand-900 placeholder:text-brand-200 focus:outline-none"
          autoComplete="off"
        />
        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-brand-900 hover:bg-page-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
          aria-label="Submit search"
        >
          <MaterialIcon name="search" />
        </button>
      </form>
    );
  }

  const mobileFieldId = `${inputId}-mobile-field`;

  return (
    <form
      action="/search"
      method="get"
      className={`flex gap-2 border-b border-brand-200 pb-3 ${className}`}
    >
      <label htmlFor={mobileFieldId} className="sr-only">
        Search
      </label>
      <input
        id={mobileFieldId}
        name="q"
        type="search"
        placeholder="Search"
        className="min-w-0 flex-1 bg-transparent font-label text-sm uppercase text-brand-900 placeholder:text-brand-200 focus:outline-none"
        autoComplete="off"
      />
      <button type="submit" className="font-label text-xs font-semibold uppercase text-brand-900">
        Go
      </button>
    </form>
  );
}
