"use client";

import { buildListHref } from "@/lib/admin/admin-list-params";
import { Input } from "@auction/ui/components/input";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";

type Props = {
  paramName?: string;
  placeholder?: string;
  className?: string;
  /** Stable id for label/input association — avoids useId hydration drift. */
  inputId?: string;
};

function defaultSearchInputId(paramName: string, inputId?: string): string {
  return inputId ?? `admin-list-search-${paramName}`;
}

function AdminListSearchFallback({
  inputId,
  paramName,
  placeholder,
  className,
}: Required<Pick<Props, "paramName" | "placeholder">> & Pick<Props, "className" | "inputId">) {
  return (
    <form className={className}>
      <label htmlFor={inputId} className="sr-only">
        {placeholder}
      </label>
      <div className="relative min-w-[12rem] max-w-md">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <Input
          id={inputId}
          name={paramName}
          defaultValue=""
          placeholder={placeholder}
          className="h-9 pl-9 font-body text-sm"
          readOnly
          aria-busy="true"
        />
      </div>
    </form>
  );
}

function AdminListSearchInner({
  inputId,
  paramName = "q",
  placeholder = "Search…",
  className,
}: Required<Pick<Props, "inputId">> & Props) {
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
          name={paramName}
          defaultValue={value}
          placeholder={placeholder}
          className="h-9 pl-9 font-body text-sm"
        />
      </div>
    </form>
  );
}

/** URL-driven list search — updates `q` (or custom) search param. */
export function AdminListSearch({
  paramName = "q",
  placeholder = "Search…",
  className,
  inputId,
}: Props) {
  const resolvedId = defaultSearchInputId(paramName, inputId);

  return (
    <Suspense
      fallback={
        <AdminListSearchFallback
          inputId={resolvedId}
          paramName={paramName}
          placeholder={placeholder}
          {...(className ? { className } : {})}
        />
      }
    >
      <AdminListSearchInner
        inputId={resolvedId}
        paramName={paramName}
        placeholder={placeholder}
        {...(className ? { className } : {})}
      />
    </Suspense>
  );
}

export { buildListHref };
