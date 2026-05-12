"use client";

import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { lotMarketingSection } from "@/components/sections/artwork/lot-marketing-sections";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import {
  adminUpdateLotMarketingDetailsResultAction,
  adminUpdateLotResultAction,
} from "@/lib/actions/admin";
import {
  type AdminLotMarketingFormValues,
  adminLotMarketingFormValuesSchema,
  formValuesToApiPatch,
  marketingDetailsToFormValues,
} from "@/lib/admin/admin-lot-marketing-mappers";
import { notify } from "@/lib/ui/notify";
import type { ArtistProfile, LotMarketingDetails } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import { updateLotMarketingDetailsSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type UseFormReturn, useFieldArray, useForm } from "react-hook-form";

type Props = {
  lotId: string;
  marketingDetails: LotMarketingDetails;
  artists: ArtistProfile[];
  /** FK on the lot row. Marketing form is read-only on this concern: catalog
   * copy and artist attribution are persisted via separate endpoints. */
  artistId: string | null;
};

export function AdminLotMarketingForm({ lotId, marketingDetails, artists, artistId }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<AdminLotMarketingFormValues>({
    resolver: zodResolver(adminLotMarketingFormValuesSchema),
    defaultValues: marketingDetailsToFormValues(marketingDetails),
  });
  return (
    <div className="space-y-8 rounded-sm border border-outline-variant/20 bg-surface-container-lowest/40 p-6">
      <div>
        <LabelCaps className="text-secondary">Catalog & marketing</LabelCaps>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Lot story</h2>
        <p className="mt-1 font-body text-sm text-on-surface-variant">
          These fields feed the public artwork page (estimate, condition, provenance, exhibitions,
          about the artist, plus fees and documents where configured). Changes apply immediately for
          lots that can still be edited in the catalogue.
        </p>
      </div>
      <ArtistAttributionPanel
        lotId={lotId}
        artists={artists}
        artistId={artistId}
        onSaved={() => router.refresh()}
      />
      <Form {...form}>
        <form
          className="space-y-10"
          onSubmit={form.handleSubmit((values) => {
            const patch = formValuesToApiPatch(values);
            const valid = updateLotMarketingDetailsSchema.safeParse(patch);
            if (!valid.success) {
              notify.error(valid.error.issues.map((i) => i.message).join("; "));
              return;
            }
            startTransition(() => {
              void (async () => {
                const r = await adminUpdateLotMarketingDetailsResultAction(lotId, valid.data);
                if (r.ok) {
                  notify.success("Catalog details saved");
                  router.refresh();
                  return;
                }
                notify.error(r.error);
              })();
            });
          })}
        >
          <EstimateFields form={form} />
          <ConditionReportFields form={form} />
          <ProvenanceListField form={form} />
          <ExhibitionsListField form={form} />
          <ArtistNoteField form={form} />
          <div className="pt-2">
            <Button type="submit" className="font-label uppercase" disabled={pending}>
              {pending ? "Saving…" : "Save catalog copy"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

/** Standalone admin control for the canonical-artist FK on a lot. Kept out of
 * the catalog-copy form because it auto-saves on change (single-purpose,
 * high-stakes assignment) and writes through the lot PATCH endpoint, not the
 * marketing-details JSON merge. */
function ArtistAttributionPanel({
  lotId,
  artists,
  artistId,
  onSaved,
}: {
  lotId: string;
  artists: ArtistProfile[];
  artistId: string | null;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<string | null>(artistId);

  function onChange(next: string | null) {
    setValue(next);
    startTransition(() => {
      void (async () => {
        const r = await adminUpdateLotResultAction(lotId, { artistId: next ?? null });
        if (r.ok) {
          notify.success(next ? "Artist attribution updated" : "Artist attribution cleared");
          onSaved();
          return;
        }
        notify.error(r.error);
        // revert on failure
        setValue(artistId);
      })();
    });
  }

  return (
    <section className="space-y-3 rounded-md border border-outline-variant/30 bg-surface-container-lowest/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-label text-sm font-semibold text-on-surface">
          Canonical artist / maker
        </h3>
        {pending ? <span className="text-xs text-on-surface-variant">Saving…</span> : null}
      </div>
      <ArtistPicker
        value={value}
        onChange={onChange}
        selected={chipFromArtists(artists, value)}
        helpText="Drives the public artist page, structured data, and 'more by this maker' rails. Sellers cannot set this."
      />
    </section>
  );
}

function chipFromArtists(
  artists: ArtistProfile[],
  artistId: string | null,
): ArtistChipModel | null {
  if (!artistId) return null;
  const found = artists.find((a) => a.id === artistId);
  if (!found) return null;
  return {
    id: found.id,
    displayName: found.displayName,
    slug: found.slug,
    kind: found.kind ?? "artist",
    status: found.status ?? "approved",
  };
}

function EstimateFields({
  form,
}: {
  form: UseFormReturn<AdminLotMarketingFormValues>;
}) {
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
}: {
  form: UseFormReturn<AdminLotMarketingFormValues>;
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
            <FormLabel className="font-label text-xs uppercase">Report PDF URL</FormLabel>
            <FormControl>
              <UnderlineInput {...field} type="url" inputMode="url" placeholder="https://…" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}

function ProvenanceListField({
  form,
}: {
  form: UseFormReturn<AdminLotMarketingFormValues>;
}) {
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
          <li key={f.id} className="space-y-3 rounded-lg border border-outline-variant/15 p-4">
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

function ExhibitionsListField({
  form,
}: {
  form: UseFormReturn<AdminLotMarketingFormValues>;
}) {
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
          <li key={f.id} className="space-y-3 rounded-lg border border-outline-variant/15 p-4">
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

function ArtistNoteField({ form }: { form: UseFormReturn<AdminLotMarketingFormValues> }) {
  return (
    <section className="space-y-4">
      <h3 className="font-label text-sm font-semibold text-on-surface">
        {lotMarketingSection.artist.title}
      </h3>
      <FormField
        control={form.control}
        name="artistNote"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="font-label text-xs uppercase">Note</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                rows={5}
                className="min-h-0"
                placeholder="Per-lot artist blurb; complements the public profile when set."
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
