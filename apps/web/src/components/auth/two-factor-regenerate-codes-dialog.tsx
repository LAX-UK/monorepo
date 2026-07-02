"use client";

import { BackupCodesDisplay } from "@/components/auth/backup-codes-display";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { UnderlineInput } from "@/components/ui/input";
import { useRegenerateBackupCodesController } from "@/lib/auth/hooks/use-regenerate-backup-codes-controller";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { useEffect, useState } from "react";
import type { Control } from "react-hook-form";

type TwoFactorRegenerateCodesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TwoFactorRegenerateCodesDialog({
  open,
  onOpenChange,
}: TwoFactorRegenerateCodesDialogProps) {
  const [phase, setPhase] = useState<"confirm" | "codes">("confirm");
  const [codes, setCodes] = useState<string[]>([]);

  const { hasPassword, accountsLoading, busy, form, submit } = useRegenerateBackupCodesController(
    (next) => {
      setCodes(next);
      setPhase("codes");
    },
  );

  useEffect(() => {
    if (!open) {
      setPhase("confirm");
      setCodes([]);
      form.reset({ password: "" });
    }
  }, [open, form]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerate backup codes</DialogTitle>
          <DialogDescription>
            {phase === "confirm"
              ? hasPassword
                ? "Enter your password. Your previous backup codes will stop working immediately after new codes are issued."
                : "Your current session confirms this change. Previous backup codes will stop working immediately after new codes are issued."
              : "Store these new codes — each works once."}
          </DialogDescription>
        </DialogHeader>

        {phase === "confirm" ? (
          <Form {...form}>
            <form className="space-y-4" onSubmit={submit} noValidate>
              {form.formState.errors.root ? (
                <p role="alert" className="text-sm text-error">
                  {form.formState.errors.root.message}
                </p>
              ) : null}
              {hasPassword && !accountsLoading ? (
                <FormField
                  control={form.control as unknown as Control<{ password: string }>}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <UnderlineInput
                          type="password"
                          autoComplete="current-password"
                          className="w-full border-b-2 border-outline-variant/40 py-3"
                          {...field}
                          disabled={busy || accountsLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <AuthSubmitButton
                  loading={busy}
                  loadingLabel="Generating…"
                  disabled={accountsLoading}
                >
                  Generate new codes
                </AuthSubmitButton>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <BackupCodesDisplay codes={codes} />
            <DialogFooter>
              <Button
                type="button"
                variant="cta"
                className="w-full font-headline uppercase"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
