"use client";

import type { StepProps } from "@/components/dashboard/submission-wizard/step-props";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
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
import { useFieldArray } from "react-hook-form";

const labelClass =
  "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

export function ProvenanceStep({ form }: StepProps) {
  const provenanceFields = useFieldArray({ control: form.control, name: "provenance" });
  const exhibitionFields = useFieldArray({ control: form.control, name: "exhibitions" });

  return (
    <div className="space-y-8" data-testid="submission-wizard-step-provenance">
      <section className="space-y-4">
        <div>
          <h3 className="font-headline text-lg font-semibold text-on-surface">Provenance</h3>
          <p className="font-body text-sm text-on-surface-variant">
            Optional. Add ownership history — newest first if you prefer.
          </p>
        </div>
        {provenanceFields.fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-outline-variant/30 px-4 py-3 text-sm text-on-surface-variant">
            No provenance entries yet. Skip if unknown; specialists can follow up.
          </p>
        ) : (
          <ul className="space-y-4">
            {provenanceFields.fields.map((row, index) => (
              <li
                key={row.id}
                className="space-y-3 rounded-lg border border-border-hairline bg-surface-container-low/40 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                    Entry {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-on-surface-variant"
                    onClick={() => provenanceFields.remove(index)}
                    aria-label={`Remove provenance entry ${index + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name={`provenance.${index}.period`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        <LabelCaps>Period (optional)</LabelCaps>
                      </FormLabel>
                      <FormControl>
                        <UnderlineInput placeholder="e.g. 2022" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`provenance.${index}.note`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        <LabelCaps>Note</LabelCaps>
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={2} className="font-body text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => provenanceFields.append({ period: "", note: "" })}
        >
          <Plus className="mr-1 size-4" aria-hidden />
          Add provenance entry
        </Button>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-headline text-lg font-semibold text-on-surface">Exhibitions</h3>
          <p className="font-body text-sm text-on-surface-variant">Optional exhibition history.</p>
        </div>
        {exhibitionFields.fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-outline-variant/30 px-4 py-3 text-sm text-on-surface-variant">
            No exhibitions listed. You can add them later while the submission is still a draft.
          </p>
        ) : (
          <ul className="space-y-4">
            {exhibitionFields.fields.map((row, index) => (
              <li
                key={row.id}
                className="space-y-3 rounded-lg border border-border-hairline bg-surface-container-low/40 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">
                    Exhibition {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-on-surface-variant"
                    onClick={() => exhibitionFields.remove(index)}
                    aria-label={`Remove exhibition ${index + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`exhibitions.${index}.year`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          <LabelCaps>Year (optional)</LabelCaps>
                        </FormLabel>
                        <FormControl>
                          <UnderlineInput placeholder="2023" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`exhibitions.${index}.venue`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          <LabelCaps>Venue</LabelCaps>
                        </FormLabel>
                        <FormControl>
                          <UnderlineInput placeholder="Gallery or museum" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name={`exhibitions.${index}.note`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>
                        <LabelCaps>Note (optional)</LabelCaps>
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={2} className="font-body text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exhibitionFields.append({ year: "", venue: "", note: "" })}
        >
          <Plus className="mr-1 size-4" aria-hidden />
          Add exhibition
        </Button>
      </section>
    </div>
  );
}
