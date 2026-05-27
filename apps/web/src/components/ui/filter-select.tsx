"use client";

import { Combobox } from "@auction/ui/components/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type FilterSelectOption = { value: string; label: string };

/** Shared trigger styling for admin/marketing URL-synced filters. */
export const filterSelectTriggerClassName =
  "h-10 min-w-[9rem] border-outline-variant/40 bg-surface-container-lowest font-label text-[0.65rem] font-semibold uppercase tracking-wider shadow-none focus:ring-primary";

type PendingNavigation = {
  pending: boolean;
  navigate: (href: string) => void;
};

type Props = {
  param: string;
  options: FilterSelectOption[];
  placeholder?: string;
  /** When set, clearing resets to this value instead of removing the param. */
  defaultValue?: string;
  className?: string;
  /** Params to set on navigation (e.g. reset offset). */
  resetParams?: Record<string, string>;
  /** Params to remove on navigation (e.g. pagination). */
  clearParams?: string[];
  /** Use searchable combobox when option count exceeds this threshold. */
  comboboxThreshold?: number;
  /** Optional aria-label for the trigger when no visible label is present. */
  ariaLabel?: string;
  /** Transform outgoing param value; return null to delete the param. */
  serializeValue?: (value: string) => string | null;
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

export function FilterSelect({
  param,
  options,
  placeholder,
  defaultValue = "",
  className = filterSelectTriggerClassName,
  resetParams,
  clearParams,
  comboboxThreshold = 20,
  ariaLabel,
  serializeValue,
  usePendingNavigation = defaultPendingNavigation,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending, navigate } = usePendingNavigation();
  const current = searchParams.get(param) ?? defaultValue;

  function onValueChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (resetParams) {
      for (const [k, v] of Object.entries(resetParams)) params.set(k, v);
    }
    if (clearParams) {
      for (const k of clearParams) params.delete(k);
    }
    const raw = next === "__all__" ? "" : next;
    const serialized = serializeValue ? serializeValue(raw) : raw;
    if (!serialized || serialized === defaultValue) params.delete(param);
    else params.set(param, serialized);
    const qs = params.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  const selectValue = current || "__all__";
  const useCombobox = options.length > comboboxThreshold;

  if (useCombobox) {
    return (
      <Combobox
        value={selectValue}
        onChange={onValueChange}
        disabled={pending}
        aria-busy={pending}
        placeholder={placeholder ?? "Select…"}
        options={options.map((o) => ({
          value: o.value || "__all__",
          label: o.label,
          keywords: o.label,
        }))}
        className={className}
      />
    );
  }

  return (
    <Select value={selectValue} onValueChange={onValueChange} disabled={pending}>
      <SelectTrigger className={className} aria-busy={pending} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || "__all__"} value={o.value || "__all__"}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
