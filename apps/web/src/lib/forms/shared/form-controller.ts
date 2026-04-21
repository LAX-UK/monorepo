import type { BaseSyntheticEvent } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/** Contract for RHF-backed form hooks (views depend on this shape only). */
export type FormController<V extends FieldValues, R = void> = {
  form: UseFormReturn<V>;
  onSubmit: (e?: BaseSyntheticEvent) => Promise<R | void>;
  isSubmitting: boolean;
  error: string | null;
};
