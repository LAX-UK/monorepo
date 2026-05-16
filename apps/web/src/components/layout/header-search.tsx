"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { KbdHint } from "@/components/marketing/kbd-hint";
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
        "hidden min-h-10 min-w-0 flex-1 items-center justify-start gap-2 rounded-none border-b px-0 py-0 text-left transition-[border-color,color,opacity] duration-300 ease-out hover:bg-transparent motion-reduce:transition-none lg:flex lg:w-[231px] lg:flex-none",
        "border-brand-300 hover:border-brand-400",
        className,
      )}
      aria-haspopup="dialog"
      aria-label="Search"
    >
      <Search
        className={cn(
          "shrink-0 text-brand-900 transition-colors duration-300 motion-reduce:transition-none dark:text-on-surface",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate py-2 font-label text-sm font-medium leading-[21px] text-brand-300 transition-colors duration-300 motion-reduce:transition-none dark:text-on-surface-variant",
        )}
      >
        Search lots, artists, sales…
      </span>
      <KbdHint className="hidden sm:inline">{isMac ? "⌘K" : "Ctrl+K"}</KbdHint>
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
        className={cn("flex gap-2 border-b border-brand-300 pb-3", className)}
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
                  className="min-h-10 border-0 bg-transparent px-0 font-label text-sm uppercase text-brand-900 shadow-none placeholder:text-brand-300 focus-visible:ring-0 dark:text-on-surface dark:placeholder:text-on-surface-variant"
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
