"use client";

import {
  adminFilterControlClassName,
  adminFilterControlSurfaceClassName,
  adminFilterFieldLabelClassName,
  adminFilterFieldStackClassName,
} from "@/components/admin/filters/admin-filter-section";
import { cn } from "@auction/ui";
import { Checkbox } from "@auction/ui/components/checkbox";
import { DateRangePicker, type DateRangeValue } from "@auction/ui/components/date-range-picker";
import { Input } from "@auction/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import type { ReactNode } from "react";

export type AdminFilterDraftSelectOption = { value: string; label: string };

type SelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly AdminFilterDraftSelectOption[];
  placeholder?: string;
  className?: string;
};

export function AdminFilterDraftSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
}: SelectProps) {
  const selectValue = value || "__all__";
  return (
    <div className={adminFilterFieldStackClassName}>
      <label htmlFor={id} className={adminFilterFieldLabelClassName}>
        {label}
      </label>
      <Select
        value={selectValue}
        onValueChange={(next) => onChange(next === "__all__" ? "" : next)}
      >
        <SelectTrigger
          id={id}
          className={cn(adminFilterControlClassName, adminFilterControlSurfaceClassName, className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="z-[var(--z-floating,70)]">
          {options.map((opt) => (
            <SelectItem key={opt.value || "__all__"} value={opt.value || "__all__"}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type ToggleRowProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
  className?: string;
};

/** Full-width checkbox row with touch-friendly hit target. */
export function AdminFilterToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
  description,
  className,
}: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-md border border-transparent px-1 py-2 transition-colors hover:bg-surface-container-low has-[:focus-visible]:border-border-hairline has-[:focus-visible]:bg-surface-container-low",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5 shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-body text-sm text-on-surface">{label}</span>
        {description ? (
          <span className="font-body text-xs text-on-surface-variant">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/** Stack multiple toggle rows with consistent spacing. */
export function AdminFilterToggleGroup({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-1", className)}>{children}</div>;
}

type CheckboxProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** @deprecated Prefer AdminFilterToggleRow for drawer filters. */
export function AdminFilterDraftCheckbox({ id, label, checked, onCheckedChange }: CheckboxProps) {
  return (
    <AdminFilterToggleRow
      id={id}
      label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  );
}

type InputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "search" | "text";
  className?: string;
};

export function AdminFilterDraftInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "search",
  className,
}: InputProps) {
  return (
    <div className={adminFilterFieldStackClassName}>
      <label htmlFor={id} className={adminFilterFieldLabelClassName}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(adminFilterControlClassName, adminFilterControlSurfaceClassName, className)}
      />
    </div>
  );
}

type DateRangeProps = {
  id: string;
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
};

export function AdminFilterDraftDateRange({ id, label, value, onChange }: DateRangeProps) {
  return (
    <div className={adminFilterFieldStackClassName}>
      <span id={`${id}-label`} className={adminFilterFieldLabelClassName}>
        {label}
      </span>
      <DateRangePicker value={value} onChange={onChange} />
    </div>
  );
}
