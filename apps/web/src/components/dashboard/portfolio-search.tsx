"use client";

import { Button } from "@/components/ui/button";
import { urlTitleSearchSchema } from "@/lib/forms/schemas/url-search";
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";

type QForm = { q: string };

export function PortfolioSearchBar({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const form = useForm<QForm>({
    resolver: zodResolver(urlTitleSearchSchema),
    defaultValues: { q: initialQ },
  });

  useEffect(() => {
    form.reset({ q: initialQ });
  }, [form, initialQ]);

  const apply = useCallback(
    (values: QForm) => {
      const next = new URLSearchParams(searchParams.toString());
      const trimmed = values.q.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  return (
    <Form {...form}>
      <form
        className="mb-8 flex flex-col gap-4 rounded-xl border border-border-hairline bg-surface-container-lowest p-4 shadow-sm sm:flex-row sm:items-end"
        onSubmit={form.handleSubmit(apply)}
      >
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="flex-1 space-y-2">
              <FormLabel
                htmlFor="portfolio-q"
                className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
              >
                Search collection
              </FormLabel>
              <FormControl>
                <Input
                  id="portfolio-q"
                  placeholder="Filter by title…"
                  className="max-w-md bg-surface-container-low"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>
    </Form>
  );
}
