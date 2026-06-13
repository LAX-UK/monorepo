"use client";

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
import {
  CONDITION_REPORT_REQUEST_NOTE_MAX,
  type ConditionReportRequestFormValues,
  conditionReportRequestFormSchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect } from "react";
import { type Resolver, useForm } from "react-hook-form";
import type { z } from "zod";

type Props = {
  onSubmitRequest: (values: ConditionReportRequestFormValues) => Promise<boolean>;
  submitting: boolean;
  apiErrorMessage: string | null;
};

export function ConditionReportRequestForm({
  onSubmitRequest,
  submitting,
  apiErrorMessage,
}: Props) {
  const form = useForm<
    z.input<typeof conditionReportRequestFormSchema>,
    unknown,
    ConditionReportRequestFormValues
  >({
    resolver: zodResolver(conditionReportRequestFormSchema) as Resolver<
      z.input<typeof conditionReportRequestFormSchema>,
      unknown,
      ConditionReportRequestFormValues
    >,
    defaultValues: { requestNote: "" },
  });

  useEffect(() => {
    if (apiErrorMessage) {
      form.setError("root", { message: apiErrorMessage });
    } else {
      form.clearErrors("root");
    }
  }, [apiErrorMessage, form]);

  const noteLen = form.watch("requestNote")?.length ?? 0;
  const busy = submitting || form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (values) => {
          form.clearErrors("root");
          await onSubmitRequest(values);
        })}
        noValidate
      >
        <fieldset className="space-y-3 border-0 p-0">
          <legend className="sr-only">Request condition report</legend>
          <p className="text-on-surface-variant">
            Specialists review the work and publish a report on this lot page. You will be notified
            when it is ready.
          </p>
          <FormField
            control={form.control}
            name="requestNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                  Note for specialists (optional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    maxLength={CONDITION_REPORT_REQUEST_NOTE_MAX}
                    placeholder="e.g. focus on frame, signature, or restoration"
                    className="min-h-20 font-body text-sm"
                    disabled={busy}
                  />
                </FormControl>
                <p className="text-xs text-on-surface-variant">
                  {noteLen}/{CONDITION_REPORT_REQUEST_NOTE_MAX}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.errors.root?.message ? (
            <p
              className="rounded-md border border-error/30 bg-error-container/15 px-3 py-2 text-sm text-on-surface"
              role="alert"
            >
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <Button
            type="submit"
            size="sm"
            className="min-h-11 w-full"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Sending…" : "Request condition report"}
          </Button>
          <p className="text-center text-xs text-on-surface-variant">
            Track progress anytime in{" "}
            <Link
              href="/dashboard/condition-reports"
              className="font-semibold text-link underline-offset-2 hover:underline"
            >
              My condition reports
            </Link>
            .
          </p>
        </fieldset>
      </form>
    </Form>
  );
}
