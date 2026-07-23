import type { ActionResult } from "@/lib/forms/form-result";

export type BulkTypedConfirmConfig = {
  title: string;
  description: string;
  actionLabel: string;
  confirmationPhrase: (selectedCount: number) => string;
};

export type BulkReasonPromptConfig = {
  title: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  actionLabel: string;
  minLength?: number;
};

export type BulkOperationRunOptions = {
  confirmationPhrase?: string;
  reason?: string;
};

export type BulkOperation = {
  id: string;
  label: string;
  confirm?: string;
  typedConfirm?: BulkTypedConfirmConfig;
  reasonPrompt?: BulkReasonPromptConfig;
  destructive?: boolean;
  run: (ids: string[], options?: BulkOperationRunOptions) => Promise<ActionResult<unknown>>;
};
