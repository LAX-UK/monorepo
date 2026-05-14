"use client";

import { CategoryPicker } from "@/components/forms/category-picker";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import { useUpdateSubmissionController } from "@/lib/forms/submission/use-update-submission-controller";
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
import type { ItemSubmissionFormValues as NewSubmissionFormValues } from "@auction/validators";

type Props = {
  submissionId: string;
  initialValues: NewSubmissionFormValues;
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

export function EditSubmissionForm({ submissionId, initialValues, categories }: Props) {
  const { form, onSubmit, isSubmitting } = useUpdateSubmissionController(
    submissionId,
    initialValues,
  );

  return (
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
                <UnderlineInput {...field} />
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
                  <LabelCaps>Medium</LabelCaps>
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
                  <LabelCaps>Dimensions</LabelCaps>
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
                  <UnderlineInput {...field} />
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
                  <UnderlineInput {...field} />
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
                <UnderlineInput {...field} />
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
                <ImageUploadField
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
                  <LabelCaps>Asking price</LabelCaps>
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
            name="reservePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Reserve</LabelCaps>
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
          name="conditionSelfReport"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                <LabelCaps>Condition</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea rows={3} className="font-body text-sm" {...field} />
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
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}
