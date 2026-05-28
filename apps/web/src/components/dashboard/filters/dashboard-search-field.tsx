"use client";

import { urlTitleSearchSchema } from "@/lib/forms/schemas/url-search";
import { cn } from "@auction/ui";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useDashboardSearchParams } from "./use-dashboard-search-params";

export type DashboardSearchFieldProps = {
  initialQ: string;
  paramKey?: string;
  label: string;
  placeholder: string;
  debounceMs?: number;
  className?: string;
  inputId?: string;
};

/** Debounced URL search input — no Apply button. */
export function DashboardSearchField({
  initialQ,
  paramKey = "q",
  label,
  placeholder,
  debounceMs = 300,
  className,
  inputId,
}: DashboardSearchFieldProps) {
  const { updateParams } = useDashboardSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = inputId ?? `${paramKey}-search`;

  const form = useForm<{ q: string }>({
    resolver: zodResolver(urlTitleSearchSchema),
    defaultValues: { q: initialQ },
  });

  useEffect(() => {
    form.reset({ q: initialQ });
  }, [form, initialQ]);

  const watchedQ = form.watch("q");
  const isPending = watchedQ.trim() !== initialQ.trim();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = watchedQ.trim();
      if (trimmed === initialQ.trim()) return;
      updateParams((next) => {
        if (trimmed) next.set(paramKey, trimmed);
        else next.delete(paramKey);
      });
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debounceMs, initialQ, paramKey, updateParams, watchedQ]);

  return (
    <Form {...form}>
      <form
        className={cn("min-w-0 flex-1", className)}
        onSubmit={(e) => e.preventDefault()}
        aria-busy={isPending || undefined}
      >
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel
                htmlFor={id}
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
              >
                {label}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    id={id}
                    placeholder={placeholder}
                    className={cn(
                      "bg-surface-container-low pr-10 motion-safe:transition-opacity",
                      isPending && "opacity-80",
                    )}
                    {...field}
                  />
                  {isPending ? (
                    <Loader2
                      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-on-surface-variant"
                      aria-hidden
                    />
                  ) : null}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
