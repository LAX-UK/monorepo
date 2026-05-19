"use client";

import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { ImageUploadField } from "@/components/forms/image-upload-field";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { Textarea } from "@auction/ui/components/textarea";
import {
  adminCategoryFormSchema,
  adminCreateCategoryBodySchema,
  adminUpdateCategoryBodySchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  const [parentPopoverOpen, setParentPopoverOpen] = useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(adminCategoryFormSchema),
    defaultValues,
  });

  const eligibleParents = categories.filter((c) => c.id !== categoryId && !c.archived);

  function getParentLabel(id: string | null | undefined): string {
    if (!id) return "No parent";
    return eligibleParents.find((c) => c.id === id)?.name ?? "Unknown";
  }

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          className="space-y-8"
          onSubmit={form.handleSubmit((values) => {
            startTransition(async () => {
              const result =
                mode === "create"
                  ? await adminCreateCategoryResultAction(
                      adminCreateCategoryBodySchema.parse(values),
                    )
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
          <CatalogFormSection
            title="Identity"
            description="Display name and URL slug."
            collapsible={false}
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
          </CatalogFormSection>

          <CatalogFormSection
            title="Hierarchy"
            description="Parent category and ordering among siblings."
            collapsible={false}
          >
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="mb-2 block">
                    <LabelCaps>Parent category</LabelCaps>
                  </FormLabel>
                  <div className="flex items-center gap-2">
                    <Popover open={parentPopoverOpen} onOpenChange={setParentPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          type="button"
                          className="min-h-11 w-full justify-between font-normal"
                        >
                          <span className="truncate">{getParentLabel(field.value)}</span>
                          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search categories…" />
                          <CommandList>
                            <CommandEmpty>No categories found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  field.onChange(null);
                                  setParentPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 size-4 ${!field.value ? "opacity-100" : "opacity-0"}`}
                                />
                                No parent
                              </CommandItem>
                              {eligibleParents.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.name}
                                  onSelect={() => {
                                    field.onChange(c.id);
                                    setParentPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 size-4 ${field.value === c.id ? "opacity-100" : "opacity-0"}`}
                                  />
                                  {c.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {field.value ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => field.onChange(null)}
                      >
                        <X className="size-4" />
                        <span className="sr-only">Clear parent</span>
                      </Button>
                    ) : null}
                  </div>
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
          </CatalogFormSection>

          <CatalogFormSection
            title="Hero image"
            description="Optional banner for the public category page."
            collapsible={false}
          >
            <FormField
              control={form.control}
              name="heroImageKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="mb-2 block">
                    <LabelCaps>Hero image</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <ImageUploadField
                      kind="category_image"
                      value={field.value ? [field.value] : []}
                      onChange={(keys) => field.onChange(keys[0] ?? null)}
                    />
                  </FormControl>
                  <p className="text-xs text-on-surface-variant">
                    Optional banner image displayed on the category landing page.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CatalogFormSection>

          {mode === "edit" ? (
            <CatalogFormSection
              title="Status"
              description="Archive without deleting."
              collapsible={false}
            >
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
                      <FormLabel className="mb-2 block">
                        <LabelCaps>Archived</LabelCaps>
                      </FormLabel>
                      <p className="font-body text-xs text-on-surface-variant">
                        Archived categories stay in history but are hidden from default pickers.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </CatalogFormSection>
          ) : null}

          <CatalogFormSection title="Description" collapsible={false}>
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
          </CatalogFormSection>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/admin/categories")}
            >
              Cancel
            </Button>
            <LoadingButton type="submit" loading={pending} loadingLabel="Saving…">
              {mode === "create" ? "Create category" : "Save changes"}
            </LoadingButton>
          </div>
        </form>
      </Form>
    </>
  );
}
