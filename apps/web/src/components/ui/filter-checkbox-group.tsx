"use client";

import { Checkbox } from "@auction/ui/components/checkbox";
import { Label } from "@auction/ui/components/label";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type FilterCheckboxOption = {
  param: string;
  label: string;
  /** Value written when checked (default `"1"`). */
  checkedValue?: string;
};

type PendingNavigation = {
  pending: boolean;
  navigate: (href: string) => void;
};

type Props = {
  options: FilterCheckboxOption[];
  className?: string;
  resetParams?: Record<string, string>;
  /** Inject shared pending navigation (e.g. marketing catalog context). */
  usePendingNavigation?: () => PendingNavigation;
};

function defaultPendingNavigation(): PendingNavigation {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return {
    pending,
    navigate: (href: string) => {
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
  };
}

export function FilterCheckboxGroup({
  options,
  className,
  resetParams,
  usePendingNavigation = defaultPendingNavigation,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending, navigate } = usePendingNavigation();

  function toggle(param: string, checked: boolean, checkedValue = "1") {
    const params = new URLSearchParams(searchParams.toString());
    if (resetParams) {
      for (const [k, v] of Object.entries(resetParams)) params.set(k, v);
    }
    if (checked) params.set(param, checkedValue);
    else params.delete(param);
    const qs = params.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className={className}>
      {options.map((opt) => {
        const checkedValue = opt.checkedValue ?? "1";
        const checked = searchParams.get(opt.param) === checkedValue;
        const id = `filter-${opt.param}`;
        return (
          <div key={opt.param} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={checked}
              disabled={pending}
              aria-busy={pending}
              onCheckedChange={(v) => toggle(opt.param, v === true, checkedValue)}
            />
            <Label htmlFor={id} className="font-body text-sm text-on-surface">
              {opt.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
