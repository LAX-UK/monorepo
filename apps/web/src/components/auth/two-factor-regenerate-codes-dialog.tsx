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

type TwoFactorRegenerateCodesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TwoFactorRegenerateCodesDialog({
  open,
  onOpenChange,
}: TwoFactorRegenerateCodesDialogProps) {
  const [phase, setPhase] = useState<"password" | "codes">("password");
  const [codes, setCodes] = useState<string[]>([]);

  const { busy, form, submit } = useRegenerateBackupCodesController((next) => {
    setCodes(next);
    setPhase("codes");
  });

  useEffect(() => {
    if (!open) {
      setPhase("password");
      setCodes([]);
      form.reset();
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
            {phase === "password"
              ? "Enter your password. Your previous backup codes will stop working immediately after new codes are issued."
              : "Store these new codes — each works once."}
          </DialogDescription>
        </DialogHeader>

        {phase === "password" ? (
          <Form {...form}>
            <form className="space-y-4" onSubmit={submit} noValidate>
              {form.formState.errors.root ? (
                <p role="alert" className="text-sm text-error">
                  {form.formState.errors.root.message}
                </p>
              ) : null}
              <FormField
                control={form.control}
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
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <AuthSubmitButton loading={busy} loadingLabel="Generating…">
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
