"use client";

import { UploadField } from "@/components/forms/upload-field";
import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { DisplayHeading, LabelCaps } from "@/components/ui/typography";
import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import { useCreateSubmissionController } from "@/lib/forms/submission/use-create-submission-controller";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Textarea } from "@auction/ui/components/textarea";
import Link from "next/link";

type Props = {
  categories: SubmissionCategoryOption[];
};

export function NewSubmissionForm({ categories }: Props) {
  const { form, onSubmit, isSubmitting } = useCreateSubmissionController();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/dashboard/submissions"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
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
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                  <LabelCaps>Category</LabelCaps>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  {...(field.value !== "" ? { value: field.value } : {})}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <Button type="submit" variant="primary" className="w-full py-4" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save draft"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
