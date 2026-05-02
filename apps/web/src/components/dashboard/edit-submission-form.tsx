"use client";

import { UploadField } from "@/components/forms/upload-field";
import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { SubmissionCategoryOption } from "@/lib/forms/submission/item-submission-form-defaults";
import type { NewSubmissionFormValues } from "@/lib/forms/submission/submission-form-schema";
import { useUpdateSubmissionController } from "@/lib/forms/submission/use-update-submission-controller";
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

type Props = {
  submissionId: string;
  initialValues: NewSubmissionFormValues;
  categories: SubmissionCategoryOption[];
};

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
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                <LabelCaps>Category</LabelCaps>
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
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
