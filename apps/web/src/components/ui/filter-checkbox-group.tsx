"use client";

import { Checkbox } from "@auction/ui/components/checkbox";
import { Label } from "@auction/ui/components/label";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterCheckboxOption = {
  param: string;
  label: string;
  /** Value written when checked (default `"1"`). */
  checkedValue?: string;
};

type Props = {
  options: FilterCheckboxOption[];
  className?: string;
  resetParams?: Record<string, string>;
};

export function FilterCheckboxGroup({ options, className, resetParams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle(param: string, checked: boolean, checkedValue = "1") {
    const params = new URLSearchParams(searchParams.toString());
    if (resetParams) {
      for (const [k, v] of Object.entries(resetParams)) params.set(k, v);
    }
    if (checked) params.set(param, checkedValue);
    else params.delete(param);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
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
