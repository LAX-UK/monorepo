"use client";

import { DocumentUploadField } from "@/components/forms/document-upload-field";
import { lotMarketingSection } from "@/components/sections/artwork/lot-marketing-sections";
import { UnderlineInput } from "@/components/ui/input";
import type { AdminLotMarketingFormValues } from "@/lib/admin/admin-lot-marketing-mappers";
import { Button } from "@auction/ui/components/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import { Plus, Trash2 } from "lucide-react";
import { type UseFormReturn, useFieldArray } from "react-hook-form";

type Props = {
  form: UseFormReturn<AdminLotMarketingFormValues>;
  pending: boolean;
};

export function LotMarketingCatalogStep({ form, pending }: Props) {
  return (
    <div className="space-y-10">
      <EstimateFields form={form} />
      <ConditionReportFields form={form} disabled={pending} />
      <ProvenanceListField form={form} />
      <ExhibitionsListField form={form} />
    </div>
  );
}

function EstimateFields({ form }: { form: UseFormReturn<AdminLotMarketingFormValues> }) {
  return (
    <section className="space-y-4">
      <h3 className="font-label text-sm font-semibold text-on-surface">Pre-sale estimate</h3>
      <p className="font-body text-xs text-on-surface-variant">
        Shown in the catalogue accordion when low, high, and currency are all set. Use plain amounts
        (e.g. 8000.00); leave empty to hide the estimate block.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="estimate.low"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase">Low</FormLabel>
              <FormControl>
                <UnderlineInput {...field} placeholder="8000.00" inputMode="decimal" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="estimate.high"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase">High</FormLabel>
              <FormControl>
                <UnderlineInput {...field} placeholder="12000.00" inputMode="decimal" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="estimate.currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase">Currency</FormLabel>
              <FormControl>
                <UnderlineInput {...field} placeholder="GBP" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}

function ConditionReportFields({
  form,
  disabled,
}: {
  form: UseFormReturn<AdminLotMarketingFormValues>;
  disabled?: boolean;
}) {
  return (
    <section className="space-y-4">
      <h3 className="font-label text-sm font-semibold text-on-surface">
        {lotMarketingSection.condition.title}
      </h3>
      <FormField
        control={form.control}
        name="conditionReport.summary"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-xs uppercase">Summary</FormLabel>
            <FormControl>
              <Textarea {...field} rows={3} className="min-h-0 resize-y" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="conditionReport.details"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-xs uppercase">Details</FormLabel>
            <FormControl>
              <Textarea {...field} rows={6} className="min-h-0 resize-y" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="conditionReport.downloadUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-xs uppercase">Condition report PDF</FormLabel>
            <FormControl>
              <DocumentUploadField
                kind="lot_document"
                valueMode="publicUrl"
                value={field.value?.trim() ? field.value.trim() : null}
                onChange={(next) => field.onChange(next ?? "")}
                busy={disabled}
              />
            </FormControl>
            <p className="mt-2 font-body text-xs text-on-surface-variant">
              Upload a PDF or image; the public catalogue link is set from your hosted file.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}

function ProvenanceListField({ form }: { form: UseFormReturn<AdminLotMarketingFormValues> }) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "provenance",
  });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-label text-sm font-semibold text-on-surface">
          {lotMarketingSection.provenance.title}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-label"
          onClick={() => append({ period: "", note: "" })}
        >
          <Plus className="mr-1 size-4" />
          Add entry
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No provenance lines yet.</p>
      ) : null}
      <ul className="space-y-4">
        {fields.map((f, i) => (
          <li key={f.id} className="space-y-3 rounded-lg border border-border-hairline p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <FormField
                  control={form.control}
                  name={`provenance.${i}.period`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-label text-xs uppercase">Period</FormLabel>
                      <FormControl>
                        <UnderlineInput {...field} placeholder="e.g. 2015–2018" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`provenance.${i}.note`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-label text-xs uppercase">Note</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} className="min-h-0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
                {i > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, i - 1)}>
                    Up
                  </Button>
                ) : null}
                {i < fields.length - 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, i + 1)}>
                    Down
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExhibitionsListField({ form }: { form: UseFormReturn<AdminLotMarketingFormValues> }) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "exhibitions",
  });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-label text-sm font-semibold text-on-surface">
          {lotMarketingSection.exhibited.title}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-label"
          onClick={() => append({ year: "", venue: "", note: "" })}
        >
          <Plus className="mr-1 size-4" />
          Add exhibition
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No exhibitions yet.</p>
      ) : null}
      <ul className="space-y-4">
        {fields.map((f, i) => (
          <li key={f.id} className="space-y-3 rounded-lg border border-border-hairline p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`exhibitions.${i}.year`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-label text-xs uppercase">Year</FormLabel>
                        <FormControl>
                          <UnderlineInput {...field} placeholder="2020" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`exhibitions.${i}.venue`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-label text-xs uppercase">Venue</FormLabel>
                        <FormControl>
                          <UnderlineInput {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name={`exhibitions.${i}.note`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-label text-xs uppercase">Note</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} className="min-h-0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
                {i > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, i - 1)}>
                    Up
                  </Button>
                ) : null}
                {i < fields.length - 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, i + 1)}>
                    Down
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
