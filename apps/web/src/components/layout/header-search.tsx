"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Form, FormControl, FormField, FormItem } from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const headerSearchSchema = z.object({
  q: z.string().trim().max(200),
});
type HeaderSearchValues = z.infer<typeof headerSearchSchema>;

export function HeaderSearchTrigger({ className = "" }: { className?: string }) {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={openCommandPalette}
      className={cn(
        "hidden min-h-10 min-w-0 flex-1 items-center justify-start gap-2 rounded-none border-b border-brand-200 px-0 py-0 text-left hover:bg-transparent lg:flex lg:w-[231px] lg:flex-none",
        className,
      )}
      aria-haspopup="dialog"
      aria-label="Search"
    >
      <Search className="shrink-0 text-brand-900 dark:text-on-surface" aria-hidden />
      <span className="min-w-0 flex-1 truncate py-2 font-label text-sm font-medium leading-[21px] text-brand-200 dark:text-on-surface-variant">
        Search lots, artists, sales…
      </span>
      <kbd className="hidden shrink-0 rounded border border-brand-200/80 bg-transparent px-1.5 py-0.5 font-mono text-[0.65rem] font-medium text-brand-900 sm:inline dark:border-outline-variant/50 dark:text-on-surface">
        {isMac ? "⌘K" : "Ctrl+K"}
      </kbd>
    </Button>
  );
}

export function HeaderSearchForm({
  className = "",
  inputId = "mobile-nav-search",
}: {
  className?: string;
  inputId?: string;
}) {
  const fieldId = `${inputId}-field`;
  const router = useRouter();
  const form = useForm<HeaderSearchValues>({
    resolver: zodResolver(headerSearchSchema),
    defaultValues: { q: "" },
  });

  return (
    <Form {...form}>
      <form
        className={cn("flex gap-2 border-b border-brand-200 pb-3", className)}
        onSubmit={form.handleSubmit((values) => {
          const q = values.q.trim();
          router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
        })}
        noValidate
      >
        <label htmlFor={fieldId} className="sr-only">
          Search
        </label>
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="min-w-0 flex-1">
              <FormControl>
                <Input
                  id={fieldId}
                  type="search"
                  placeholder="Search"
                  className="min-h-10 border-0 bg-transparent px-0 font-label text-sm uppercase text-brand-900 shadow-none placeholder:text-brand-200 focus-visible:ring-0 dark:text-on-surface dark:placeholder:text-on-surface-variant"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-0 font-label text-xs font-semibold uppercase text-brand-900 hover:bg-transparent dark:text-on-surface"
        >
          Go
        </Button>
      </form>
    </Form>
  );
}
