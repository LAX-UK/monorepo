"use client";

import { CategoryPicker } from "@/components/forms/category-picker";
import { UploadField } from "@/components/forms/upload-field";
import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import { useCreateSubmissionController } from "@/lib/forms/submission/use-create-submission-controller";
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
import Link from "next/link";

type Props = {
  categories: SubmissionCategoryOption[];
};

function provenanceToText(value: { period?: string | undefined; note: string }[]): string {
  return value.map((entry) => [entry.period, entry.note].filter(Boolean).join(" - ")).join("\n");
}

function textToProvenance(value: string): { period?: string | undefined; note: string }[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [period = "", ...rest] = line.split(" - ");
      const note = rest.join(" - ").trim();
      return note ? { period: period.trim(), note } : { note: line };
    });
}

function exhibitionsToText(
  value: { year?: string | undefined; venue: string; note?: string | undefined }[],
): string {
  return value
    .map((entry) => [entry.year, entry.venue, entry.note].filter(Boolean).join(" - "))
    .join("\n");
}

function textToExhibitions(
  value: string,
): { year?: string | undefined; venue: string; note?: string | undefined }[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [first = "", second, ...rest] = line.split(" - ");
      const note = rest.join(" - ").trim();
      if (second) return { year: first.trim(), venue: second.trim(), ...(note ? { note } : {}) };
      return { venue: line };
    });
}

export function NewSubmissionForm({ categories }: Props) {
  const { form, onSubmit, isSubmitting } = useCreateSubmissionController();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/dashboard/submissions"
        className="inline-flex min-h-10 items-center font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Submissions
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        Sell an item
      </DisplayHeading>
      <p className="font-body text-sm text-on-surface-variant">
        Provide accurate catalog information. Our team reviews every submission before a draft lot
        is created. Upload clear photos of the item, including detail shots where useful.
      </p>
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-8">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Title</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="Work title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Description</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea rows={5} className="font-body text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="medium"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                    <LabelCaps>Medium (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dimensions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                    <LabelCaps>Dimensions (optional)</LabelCaps>
                  </FormLabel>
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
            name="categoryIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Categories</LabelCaps>
                </FormLabel>
                <FormControl>
                  <CategoryPicker
                    categories={categories}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="yearOfWork"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                    <LabelCaps>Year of work</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="2024 or circa 1990" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="edition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                    <LabelCaps>Edition</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="3/8, AP, unique..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="isSigned"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                </FormControl>
                <FormLabel className="font-body text-sm">The work is signed</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="signatureNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Signature note</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UnderlineInput placeholder="Signed lower right, verso label..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Images</LabelCaps>
                </FormLabel>
                <FormControl>
                  <UploadField
                    kind="submission_image"
                    multiple
                    maxFiles={20}
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="askingPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                    <LabelCaps>Asking price (optional)</LabelCaps>
                  </FormLabel>
                  <p className="mb-1 font-body text-xs text-on-surface-variant">
                    Shown only to reviewers for context; not displayed to bidders until published as
                    a lot.
                  </p>
                  <FormControl>
                    <UnderlineInput placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reservePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                    <LabelCaps>Reserve (optional)</LabelCaps>
                  </FormLabel>
                  <FormControl>
                    <UnderlineInput placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="conditionSelfReport"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Condition</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    className="font-body text-sm"
                    placeholder="Describe any marks, repairs, framing, or conservation notes."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="provenance"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Provenance</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    className="font-body text-sm"
                    placeholder="One per line, e.g. 2022 - Acquired from the artist."
                    value={provenanceToText(field.value)}
                    onChange={(event) => field.onChange(textToProvenance(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="exhibitions"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Exhibitions</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    className="font-body text-sm"
                    placeholder="One per line, e.g. 2023 - Royal Academy - Summer show."
                    value={exhibitionsToText(field.value)}
                    onChange={(event) => field.onChange(textToExhibitions(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="submitterNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Notes for reviewers</LabelCaps>
                </FormLabel>
                <FormControl>
                  <Textarea rows={3} className="font-body text-sm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <aside className="rounded-lg border border-outline-variant/20 bg-surface-container-low/30 p-4 font-body text-xs text-on-surface-variant">
            <p className="font-label text-[10px] uppercase tracking-widest text-secondary">
              Draft checklist
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Sharp, colour-accurate photos including signature or markings</li>
              <li>Dimensions and medium confirmed</li>
              <li>Provenance summary where available</li>
            </ul>
            <p className="mt-3">
              Copy details from an earlier submission manually for now—automated “copy previous” is
              on the backlog.
            </p>
          </aside>
          <Button type="submit" variant="primary" className="w-full py-4" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save draft"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
