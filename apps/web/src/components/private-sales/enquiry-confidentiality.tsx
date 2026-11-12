"use client";

import type { EnquiryFormValues } from "@/lib/private-sales/enquiry-values";
import { Checkbox } from "@auction/ui/lax/checkbox";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

/**
 * Above the button: how a private enquiry is treated, as a plain line with the privacy notice, not
 * a box to tick. News of sales is a separate choice, unticked, and sending never depends on it.
 */
export function EnquiryConfidentiality({ form }: { form: UseFormReturn<EnquiryFormValues> }) {
  const optInId = useId();
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2.5 rounded-lax-control bg-lax-sunken px-3.5 py-3 text-lax-12 leading-[18px] text-lax-muted">
        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
        <p className="m-0">
          <strong className="font-semibold text-lax-fg">In confidence.</strong> Only our specialist
          team sees a private sale enquiry. We use your details to answer it and keep them as our{" "}
          <Link
            href="/privacy"
            className="font-medium text-lax-fg underline underline-offset-4 hover:no-underline"
          >
            privacy notice
          </Link>{" "}
          explains.
        </p>
      </div>
      <Controller
        control={form.control}
        name="marketingOptIn"
        render={({ field }) => (
          <div className="flex items-start gap-2.5 text-lax-13 leading-5 text-lax-fg">
            <Checkbox
              id={optInId}
              className="mt-0.5"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            <label htmlFor={optInId} className="cursor-pointer">
              Send me news of sales and private sale opportunities.{" "}
              <span className="text-lax-muted">You can stop at any time.</span>
            </label>
          </div>
        )}
      />
    </div>
  );
}
