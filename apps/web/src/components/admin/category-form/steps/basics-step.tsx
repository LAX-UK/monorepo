"use client";

import { CatalogFormSection } from "@/components/admin/forms/catalog-form-section";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { Category } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import type { adminCategoryFormSchema } from "@auction/validators";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

type CategoryFormValues = z.infer<typeof adminCategoryFormSchema>;

type Props = {
  form: UseFormReturn<CategoryFormValues>;
  mode: "create" | "edit";
  categoryId?: string;
  /** Read-only slug shown on edit (server-generated at create). */
  slug?: string;
  categories: Category[];
};

export function CategoryBasicsStep({ form, mode, categoryId, slug, categories }: Props) {
  const [parentPopoverOpen, setParentPopoverOpen] = useState(false);
  const eligibleParents = categories.filter((c) => c.id !== categoryId && !c.archived);

  function getParentLabel(id: string | null | undefined): string {
    if (!id) return "No parent";
    return eligibleParents.find((c) => c.id === id)?.name ?? "Unknown";
  }

  return (
    <>
      <CatalogFormSection
        title="Identity"
        description={
          mode === "edit"
            ? "Display name and public URL slug (slug is set at creation)."
            : "Display name — a unique public slug is generated when you save."
        }
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

        {mode === "edit" && slug ? (
          <div>
            <p className="mb-2 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
              Slug
            </p>
            <p className="font-mono text-sm text-on-surface">/{slug}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Generated at creation and cannot be changed.
            </p>
          </div>
        ) : null}
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
                              value={c.id}
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
    </>
  );
}
