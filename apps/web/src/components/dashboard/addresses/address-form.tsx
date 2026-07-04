"use client";

import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { createAddressBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { AddressFormValues } from "./address-board-helpers";
import { AddressFields } from "./address-form-fields";

export function AddressForm({
  resetKey,
  initialValues,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  resetKey: string;
  initialValues: AddressFormValues;
  pending: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (values: AddressFormValues) => void;
}) {
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(createAddressBodySchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the edited address (resetKey) changes, not on every initialValues identity change during re-renders.
  useEffect(() => {
    form.reset(initialValues);
  }, [form, resetKey]);

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => onSubmit(values))}>
        <AddressFields form={form} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={pending}>
            {submitLabel}
          </Button>
          {onCancel ? (
            <Button type="button" variant="tertiary" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
