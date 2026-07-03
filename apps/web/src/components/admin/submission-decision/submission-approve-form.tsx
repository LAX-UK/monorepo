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
import type { RefObject } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { type ApproveFormValues, approveFormSchema } from "./use-submission-decision-actions";

type Props = {
  pending: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (values: ApproveFormValues, form: UseFormReturn<ApproveFormValues>) => void;
};

export function SubmissionApproveForm({ pending, formRef, onSubmit }: Props) {
  const form = useForm({
    resolver: zodResolver(approveFormSchema),
    defaultValues: { reviewNotes: "", artistId: null },
  });

  return (
    <Form {...form}>
      <form
        id={CATALOG_FORM_IDS.submissionApprove}
        ref={formRef}
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => onSubmit(values, form))}
      >
        <FormField
          control={form.control}
          name="reviewNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                <LabelCaps>Internal review notes (optional)</LabelCaps>
              </FormLabel>
              <FormControl>
                <Textarea
                  id="reviewNotesApprove"
                  rows={3}
                  className="font-body text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
          Accept for cataloguing
        </Button>
      </form>
    </Form>
  );
}
