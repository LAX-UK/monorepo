"use client";

import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import {
  adminCreateCategoryResultAction,
  adminUpdateCategoryResultAction,
} from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import type { Category } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import {
  adminCategoryFormSchema,
  adminCreateCategoryBodySchema,
  adminUpdateCategoryBodySchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

type CategoryFormValues = z.infer<typeof adminCategoryFormSchema>;

type Props = {
  mode: "create" | "edit";
  categoryId?: string;
  categories: Category[];
  defaultValues: CategoryFormValues;
};

export function AdminCategoryForm({ mode, categoryId, categories, defaultValues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(adminCategoryFormSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        className="space-y-8"
        onSubmit={form.handleSubmit((values) => {
          startTransition(async () => {
            const result =
              mode === "create"
                ? await adminCreateCategoryResultAction(adminCreateCategoryBodySchema.parse(values))
                : categoryId
                  ? await adminUpdateCategoryResultAction(
                      categoryId,
                      adminUpdateCategoryBodySchema.parse(values),
                    )
                  : { ok: false as const, error: "Missing category" };
            if (result.ok) {
              notify.success(mode === "create" ? "Category created" : "Category saved");
              router.push("/admin/categories");
              router.refresh();
              return;
            }
            notify.error(result.error);
          });
        })}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Name</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput placeholder="Contemporary Art" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Slug</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  placeholder="Auto-generated from name"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <p className="text-xs text-on-surface-variant">
                Leave blank to generate a unique public slug.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Parent category</LabelCaps>
              </FormLabel>
              <FormControl>
                <select
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(event.target.value || null)}
                  onBlur={field.onBlur}
                  className="min-h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface"
                >
                  <option value="">No parent</option>
                  {categories
                    .filter((category) => category.id !== categoryId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {category.archived ? " (archived)" : ""}
                      </option>
                    ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Sort order</LabelCaps>
              </FormLabel>
              <FormControl>
                <UnderlineInput
                  type="number"
                  min={0}
                  max={10000}
                  placeholder="0"
                  {...field}
                  value={field.value ?? 0}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === "edit" ? (
          <FormField
            control={form.control}
            name="archived"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-outline-variant/40 p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-body text-sm font-medium text-on-surface">
                    Archived
                  </FormLabel>
                  <p className="font-body text-xs text-on-surface-variant">
                    Archived categories stay in history but are hidden from default pickers.
                  </p>
                </div>
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Description</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="Internal description or public category copy"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.push("/admin/categories")}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create category" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
