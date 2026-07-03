"use client";

import { LabelCaps } from "@/components/ui/typography";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { type UseFormReturn, useForm } from "react-hook-form";
import { type RejectFormValues, rejectFormSchema } from "./use-submission-decision-actions";

type Props = {
  pending: boolean;
  onSubmit: (values: RejectFormValues, form: UseFormReturn<RejectFormValues>) => void;
};

export function SubmissionRejectForm({ pending, onSubmit }: Props) {
  const form = useForm({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { rejectionReason: "", reviewNotes: "" },
  });

  return (
    <Form {...form}>
      <form
        id={CATALOG_FORM_IDS.submissionReject}
        className="space-y-4 border-t border-border-hairline pt-8"
        onSubmit={form.handleSubmit((values) => onSubmit(values, form))}
      >
        <FormField
          control={form.control}
          name="rejectionReason"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block" htmlFor="rejectionReason">
                <LabelCaps>Rejection reason (required)</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea
                  id="rejectionReason"
                  rows={3}
                  className="font-body text-sm"
                  required
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reviewNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Additional notes (optional)</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea
                  id="reviewNotesReject"
                  rows={2}
                  className="font-body text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="destructive"
          className="min-h-11 w-full sm:w-auto"
          disabled={pending}
        >
          Reject
        </Button>
      </form>
    </Form>
  );
}
